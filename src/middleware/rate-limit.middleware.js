'use strict';

const { getClient } = require('../utils/cache');

/**
 * Custom Redis-backed distributed rate limiting middleware.
 * Falls back gracefully to memory cache if Redis is disabled or down.
 *
 * Features:
 *  - Retry-After header on 429 (RFC 6585 compliant)
 *  - X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers on all responses
 *  - bypassRoles: array of role strings that skip the limiter entirely (e.g. SUPER_ADMIN)
 */
const rateLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 100,
  message = 'Too many requests',
  bypassRoles = [],
}) => {
  const windowSecs = Math.ceil(windowMs / 1000);
  const memoryCache = new Map();

  return async (req, res, next) => {
    // Exclude public docs/swagger
    if (req.path.startsWith('/api/docs')) {
      return next();
    }

    // Super Admin bypass (and any other configured bypass roles)
    if (bypassRoles.length && req.user && bypassRoles.includes(req.user.role)) {
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', String(max));
      res.set('X-RateLimit-Reset', String(Math.ceil((Date.now() + windowMs) / 1000)));
      return next();
    }

    // Use user ID for authenticated requests, IP for anonymous
    const identifier = req.user?.userId || req.ip;
    const key = `rl:${identifier}:${req.originalUrl}`;
    const redis = getClient();

    if (!redis) {
      // ── Memory fallback ──────────────────────────────────────────────────────
      const now = Date.now();
      let record = memoryCache.get(key);
      if (!record || record.resetTime < now) {
        record = { hits: 1, resetTime: now + windowMs };
        memoryCache.set(key, record);
      } else {
        record.hits += 1;
      }

      const remaining = Math.max(0, max - record.hits);
      const resetSecs  = Math.ceil(record.resetTime / 1000);
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);

      res.set('X-RateLimit-Limit',     String(max));
      res.set('X-RateLimit-Remaining', String(remaining));
      res.set('X-RateLimit-Reset',     String(resetSecs));

      if (record.hits > max) {
        res.set('Retry-After', String(Math.max(1, retryAfter)));
        return res.status(429).json({ success: false, message });
      }
      return next();
    }

    try {
      // ── Redis path ───────────────────────────────────────────────────────────
      const hits = await redis.incr(key);
      if (hits === 1) {
        await redis.expire(key, windowSecs);
      }

      // Get TTL for Retry-After and X-RateLimit-Reset
      const ttl      = await redis.ttl(key);
      const ttlSafe  = ttl > 0 ? ttl : windowSecs;
      const resetAt  = Math.ceil((Date.now() / 1000) + ttlSafe);
      const remaining = Math.max(0, max - hits);

      res.set('X-RateLimit-Limit',     String(max));
      res.set('X-RateLimit-Remaining', String(remaining));
      res.set('X-RateLimit-Reset',     String(resetAt));

      if (hits > max) {
        res.set('Retry-After', String(ttlSafe));
        return res.status(429).json({ success: false, message });
      }
      next();
    } catch (err) {
      // Graceful fallback to next() on connection/Redis error — never block traffic
      next();
    }
  };
};

// Export pre-configured limiters
// Super Admin is bypassed on all limiters — they should never be rate limited
const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  bypassRoles: ['SUPER_ADMIN'],
});

const generalLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests. Please try again later.',
  bypassRoles: ['SUPER_ADMIN'],
});

const shipmentLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Shipment booking rate limit exceeded. Please throttle your requests.',
  bypassRoles: ['SUPER_ADMIN'],
});

const webhookLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 200,
  message: 'Webhook processing rate limit exceeded.',
  bypassRoles: ['SUPER_ADMIN'],
});

const trackingLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Tracking rate limit exceeded. Please wait a minute.',
  bypassRoles: ['SUPER_ADMIN'],
});

const addressBookWriteLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Address book write rate limit exceeded. Please wait a minute.',
  bypassRoles: ['SUPER_ADMIN'],
});

module.exports = {
  rateLimiter,
  authLimiter,
  generalLimiter,
  shipmentLimiter,
  webhookLimiter,
  trackingLimiter,
  addressBookWriteLimiter,
};
