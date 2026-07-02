/**
 * src/utils/cache.js
 *
 * Redis-backed cache utility (ioredis).
 *
 * Design principles:
 *  - Non-fatal: every operation is wrapped in try/catch.
 *    A Redis failure NEVER crashes or slows the app — it falls back to DB silently.
 *  - Lazy connect: client connects only when first used.
 *  - REDIS_ENABLED=false disables caching entirely (CI/test environments).
 *  - Two-level Velocity token cache: L1 = in-memory, L2 = Redis.
 *  - Uses SCAN instead of KEYS for pattern deletion — safe in production.
 *  - All keys prefixed with "vx:" to avoid collisions on shared Redis instances.
 */

'use strict';

const Redis   = require('ioredis');
const { env } = require('../config/env');
const logger  = require('./logger');

// ── Singleton client ──────────────────────────────────────────────────────────
let _client = null;

const getClient = () => {
  if (!env.REDIS_ENABLED) return null;
  if (_client) return _client;

  _client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest:  3,
    enableReadyCheck:      true,
    lazyConnect:           true,        // connect() called explicitly at startup
    connectTimeout:        5_000,       // 5 s to establish connection
    commandTimeout:        3_000,       // 3 s per command — prevents slow Redis from blocking requests
    retryStrategy: (times) => {
      // Give up after 10 attempts — Redis is clearly unavailable.
      // App continues to run without cache (non-fatal).
      if (times > 10) {
        logger.warn('redis_retry_abandoned', { note: 'Redis unreachable after 10 attempts — running without cache' });
        return null; // null = stop retrying
      }
      // Exponential back-off, capped at 30 s
      const delay = Math.min(times * 300, 30_000);
      logger.warn('redis_retry', { attempt: times, delayMs: delay });
      return delay;
    },
  });

  _client.on('connect',      () => logger.info('redis_connected',     { url: env.REDIS_URL }));
  _client.on('ready',        () => logger.info('redis_ready'));
  _client.on('error',        (err) => logger.error('redis_error',     { error: err.message }));
  _client.on('close',        () => logger.warn('redis_disconnected'));
  _client.on('reconnecting', (ms) => logger.info('redis_reconnecting', { delayMs: ms }));

  return _client;
};

// ── connect — called once at server startup ───────────────────────────────────
const connect = async () => {
  if (!env.REDIS_ENABLED) {
    logger.info('redis_disabled', { reason: 'REDIS_ENABLED=false — all cache calls are no-ops' });
    return;
  }
  try {
    await getClient().connect();
  } catch (err) {
    // Non-fatal: the app runs perfectly without Redis — just without caching.
    logger.warn('redis_connect_failed', { error: err.message, note: 'App will run without cache' });
  }
};

// ── disconnect — called on graceful shutdown ──────────────────────────────────
const disconnect = async () => {
  if (_client) {
    await _client.quit().catch(() => {});
    _client = null;
  }
};

// ── get ───────────────────────────────────────────────────────────────────────
// Returns the parsed value or null on miss / error.
const get = async (key) => {
  const client = getClient();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    return raw !== null ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn('redis_get_failed', { key, error: err.message });
    return null;        // treat as cache miss — caller falls back to DB
  }
};

// ── set ───────────────────────────────────────────────────────────────────────
// Stores value as JSON with an explicit TTL (seconds). Silently no-ops on error.
const set = async (key, value, ttlSeconds) => {
  const client = getClient();
  if (!client) return;
  const ttl = ttlSeconds ?? TTL.DEFAULT;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    logger.warn('redis_set_failed', { key, error: err.message });
  }
};

// ── del — delete one or more specific keys ────────────────────────────────────
const del = async (...keys) => {
  const client = getClient();
  if (!client || keys.length === 0) return;
  try {
    await client.del(...keys);
  } catch (err) {
    logger.warn('redis_del_failed', { keys, error: err.message });
  }
};

// ── delPattern — delete by glob pattern (e.g. "vx:rate:cards:*") ─────────────
// Uses incremental SCAN to avoid blocking Redis in production.
// KEYS command is O(N) and blocks the server — SCAN is the safe alternative.
const delPattern = async (pattern) => {
  const client = getClient();
  if (!client) return;
  try {
    let cursor = '0';
    let deleted = 0;
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await client.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');

    if (deleted > 0) {
      logger.debug('redis_pattern_deleted', { pattern, deleted });
    }
  } catch (err) {
    logger.warn('redis_delpattern_failed', { pattern, error: err.message });
  }
};

// ── remember — cache-aside helper ────────────────────────────────────────────
// Check cache → on hit return immediately.
// On miss → call fn() → store result → return result.
// fn() errors propagate — remember() never swallows DB errors.
const remember = async (key, ttlSeconds, fn) => {
  const cached = await get(key);
  if (cached !== null) {
    logger.debug('cache_hit', { key });
    return cached;
  }
  logger.debug('cache_miss', { key });
  const fresh = await fn();          // DB / API call
  await set(key, fresh, ttlSeconds); // store (non-fatal if Redis is down)
  return fresh;
};

// ── TTL constants (all in seconds) ───────────────────────────────────────────
const TTL = Object.freeze({
  DEFAULT:        5 * 60,            //  5 min  — generic fallback
  RATE_CARDS:    10 * 60,            // 10 min  — rate cards rarely change
  MARGIN_CONFIG: 10 * 60,            // 10 min  — distributor margins rarely change
  SHIPMENT_STATS: 2 * 60,            //  2 min  — dashboard counts; slight staleness acceptable
  REPORT:         5 * 60,            //  5 min  — heavy aggregation pipelines
  USER_PROFILE:   5 * 60,            //  5 min  — auth middleware user lookup
  VELOCITY_TOKEN: 23 * 60 * 60,      // 23 hrs  — Velocity tokens valid 24 hrs
  SERVICEABILITY: 30 * 60,           // 30 min  — pincode route data is stable
});

// ── Cache key builders ────────────────────────────────────────────────────────
// Centralised so key format never drifts between set and del calls.
// All keys carry the "vx:" prefix to namespace on shared Redis instances.
const KEYS = Object.freeze({
  rateCards:       ()                        => 'vx:rate:cards:all',
  rateCard:        (id)                      => `vx:rate:card:${id}`,
  marginConfig:    (distId, cardId)          => `vx:rate:margin:${distId}:${cardId}`,
  shipmentStats:   (userId)                  => `vx:stats:shipments:${userId}`,
  report:          (type, userId, hash)      => `vx:report:${type}:${userId}:${hash}`,
  userProfile:     (userId)                  => `vx:user:profile:${userId}`,
  velocityToken:   ()                        => 'vx:velocity:auth:token',
  serviceability:  (from, to, cod, fwd)      => `vx:svc:${from}:${to}:${cod ? 1 : 0}:${fwd ? 1 : 0}`,
});

module.exports = {
  connect,
  disconnect,
  getClient,
  get,
  set,
  del,
  delPattern,
  remember,
  TTL,
  KEYS,
};
