/**
 * tests/utils/cache.test.js
 *
 * Tests for src/utils/cache.js
 *
 * Strategy:
 *  - Set required env vars before any require() to satisfy src/config/env.js validation.
 *  - Mock ioredis so no real Redis connection is made.
 *  - Mock the logger to suppress noise.
 *  - Because cache.js uses a module-level `_client` singleton, jest.resetModules()
 *    is called in beforeEach so each test group gets a fresh module with a fresh _client.
 */

'use strict';

// ── Required env vars — must be set BEFORE any require() ─────────────────────
process.env.MONGODB_URI        = 'mongodb://localhost:27017/test';
process.env.JWT_SECRET         = 'xK9#mP2qR7vL4nW1cJ6bT3hY8zA0dF5g';
process.env.JWT_EXPIRES_IN     = '1h';
process.env.EMAIL_FROM         = 'test@example.com';
process.env.FRONTEND_URL       = 'http://localhost:3000';
process.env.VELOCITY_USERNAME  = 'test-user';
process.env.VELOCITY_PASSWORD  = 'test-pass';
process.env.REDIS_URL          = 'redis://localhost:6379';
process.env.REDIS_ENABLED      = 'true';

// ── Top-level mocks (stable across resetModules — re-applied in beforeEach) ──
jest.mock('ioredis');
jest.mock('../../src/utils/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────

describe('cache utility', () => {
  let cache;
  let mockClient;

  beforeEach(() => {
    // Reset module registry so _client singleton is wiped on each test.
    jest.resetModules();

    // Re-apply mocks after resetModules (registry was cleared).
    jest.mock('ioredis');
    jest.mock('../../src/utils/logger', () => ({
      info:  jest.fn(),
      warn:  jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    // Build a fresh mock client.
    mockClient = {
      get:     jest.fn(),
      set:     jest.fn(),
      del:     jest.fn(),
      scan:    jest.fn(),
      quit:    jest.fn().mockResolvedValue(undefined),
      on:      jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
    };

    // Make the ioredis constructor return our mock client.
    const Redis = require('ioredis');
    Redis.mockImplementation(() => mockClient);

    // Make sure REDIS_ENABLED is true for most tests.
    process.env.REDIS_ENABLED = 'true';

    // Load cache fresh (after mocks are in place).
    cache = require('../../src/utils/cache');
  });

  // ── get(key) ──────────────────────────────────────────────────────────────

  describe('get(key)', () => {
    it('returns parsed JS value when Redis returns a JSON string', async () => {
      const value = { name: 'Alice', age: 30 };
      mockClient.get.mockResolvedValue(JSON.stringify(value));

      const result = await cache.get('some-key');

      expect(result).toEqual(value);
      expect(mockClient.get).toHaveBeenCalledWith('some-key');
    });

    it('returns null on cache miss (client returns null)', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await cache.get('missing-key');

      expect(result).toBeNull();
    });

    it('returns null and does not throw when client.get throws', async () => {
      mockClient.get.mockRejectedValue(new Error('Redis connection lost'));

      await expect(cache.get('error-key')).resolves.toBeNull();
    });
  });

  // ── set(key, value, ttl) ──────────────────────────────────────────────────

  describe('set(key, value, ttl)', () => {
    it('calls client.set with JSON-serialised value and EX ttl', async () => {
      const value = { id: 1, label: 'test' };
      mockClient.set.mockResolvedValue('OK');

      await cache.set('my-key', value, 120);

      expect(mockClient.set).toHaveBeenCalledWith(
        'my-key',
        JSON.stringify(value),
        'EX',
        120,
      );
    });

    it('does not throw when client.set rejects', async () => {
      mockClient.set.mockRejectedValue(new Error('Write failed'));

      await expect(cache.set('my-key', { x: 1 }, 60)).resolves.toBeUndefined();
    });
  });

  // ── del(...keys) ──────────────────────────────────────────────────────────

  describe('del(...keys)', () => {
    it('calls client.del with the provided keys', async () => {
      mockClient.del.mockResolvedValue(2);

      await cache.del('key1', 'key2');

      expect(mockClient.del).toHaveBeenCalledWith('key1', 'key2');
    });
  });

  // ── delPattern(pattern) ───────────────────────────────────────────────────

  describe('delPattern(pattern)', () => {
    it('uses SCAN iteration and calls del on matched keys', async () => {
      // Single scan call: cursor '0' → done immediately, returns two keys.
      mockClient.scan.mockResolvedValue(['0', ['vx:rate:cards:all', 'vx:rate:card:1']]);
      mockClient.del.mockResolvedValue(2);

      await cache.delPattern('vx:rate:*');

      expect(mockClient.scan).toHaveBeenCalledWith('0', 'MATCH', 'vx:rate:*', 'COUNT', 100);
      expect(mockClient.del).toHaveBeenCalledWith('vx:rate:cards:all', 'vx:rate:card:1');
    });
  });

  // ── remember(key, ttl, fn) ────────────────────────────────────────────────

  describe('remember(key, ttl, fn)', () => {
    it('returns cached value and does NOT call fn on cache hit', async () => {
      const cached = { user: 'Bob' };
      mockClient.get.mockResolvedValue(JSON.stringify(cached));

      const fn = jest.fn();
      const result = await cache.remember('user-key', 300, fn);

      expect(result).toEqual(cached);
      expect(fn).not.toHaveBeenCalled();
    });

    it('calls fn, stores result via set, and returns fn result on cache miss', async () => {
      const fresh = { user: 'Carol' };
      mockClient.get.mockResolvedValue(null);      // cache miss
      mockClient.set.mockResolvedValue('OK');

      const fn = jest.fn().mockResolvedValue(fresh);
      const result = await cache.remember('user-key', 300, fn);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(result).toEqual(fresh);
      expect(mockClient.set).toHaveBeenCalledWith(
        'user-key',
        JSON.stringify(fresh),
        'EX',
        300,
      );
    });
  });

  // ── REDIS_ENABLED=false ───────────────────────────────────────────────────

  describe('when REDIS_ENABLED is false', () => {
    beforeEach(() => {
      jest.resetModules();
      process.env.REDIS_ENABLED = 'false';

      jest.mock('ioredis');
      jest.mock('../../src/utils/logger', () => ({
        info:  jest.fn(),
        warn:  jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }));

      const Redis = require('ioredis');
      mockClient = {
        get:     jest.fn(),
        set:     jest.fn(),
        del:     jest.fn(),
        scan:    jest.fn(),
        quit:    jest.fn().mockResolvedValue(undefined),
        on:      jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
      };
      Redis.mockImplementation(() => mockClient);

      cache = require('../../src/utils/cache');
    });

    it('get returns null without touching the client', async () => {
      const result = await cache.get('any-key');
      expect(result).toBeNull();
      expect(mockClient.get).not.toHaveBeenCalled();
    });

    it('set is a no-op and does not throw', async () => {
      await expect(cache.set('any-key', { a: 1 }, 60)).resolves.toBeUndefined();
      expect(mockClient.set).not.toHaveBeenCalled();
    });
  });

  // ── TTL constants ─────────────────────────────────────────────────────────

  describe('TTL constants', () => {
    it('all TTL values are positive integers', () => {
      for (const [name, value] of Object.entries(cache.TTL)) {
        expect(typeof value).toBe('number');
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
    });
  });

  // ── KEYS builders ─────────────────────────────────────────────────────────

  describe('KEYS builders', () => {
    it('all KEYS functions return strings starting with "vx:"', () => {
      const samples = [
        cache.KEYS.rateCards(),
        cache.KEYS.rateCard('123'),
        cache.KEYS.marginConfig('dist1', 'card1'),
        cache.KEYS.shipmentStats('user1'),
        cache.KEYS.report('monthly', 'user1', 'abc123'),
        cache.KEYS.userProfile('user1'),
        cache.KEYS.velocityToken(),
        cache.KEYS.serviceability('400001', '560001', true, false),
      ];

      for (const key of samples) {
        expect(typeof key).toBe('string');
        expect(key.startsWith('vx:')).toBe(true);
      }
    });

    it('KEYS.userProfile("abc") returns "vx:user:profile:abc"', () => {
      expect(cache.KEYS.userProfile('abc')).toBe('vx:user:profile:abc');
    });
  });
});
