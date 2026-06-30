'use strict';

const { Idempotency } = require('../modules/finance/idempotency.model');

const idempotency = () => {
  return async (req, res, next) => {
    const key = req.headers['x-idempotency-key'];

    if (!key) {
      return next();
    }

    try {
      // 1. Check existing key
      const record = await Idempotency.findOne({ key });
      if (record) {
        if (record.inFlight) {
          return res.status(409).json({
            success: false,
            message: 'Another request with the same idempotency key is already in progress.',
            error: 'ConflictError',
            requestId: req.requestId || null,
            timestamp: new Date().toISOString(),
          });
        }
        return res.status(record.responseStatus).json(record.responseBody);
      }

      // 2. Try to acquire lock
      try {
        await Idempotency.create({ key, inFlight: true });
      } catch (err) {
        // Unique index collision: duplicate request arrived concurrently
        if (err.code === 11000) {
          return res.status(409).json({
            success: false,
            message: 'Another request with the same idempotency key is already in progress.',
            error: 'ConflictError',
            requestId: req.requestId || null,
            timestamp: new Date().toISOString(),
          });
        }
        throw err;
      }

      // 3. Intercept response send to cache it
      const originalJson = res.json;
      res.json = function (body) {
        // Only cache 2xx, 3xx, 4xx responses
        if (res.statusCode >= 200 && res.statusCode < 500) {
          Idempotency.findOneAndUpdate(
            { key },
            {
              inFlight: false,
              responseStatus: res.statusCode,
              responseBody: body,
            }
          ).catch((e) => console.error('[Idempotency] Save failed:', e.message));
        } else {
          // If server error, release lock so user can retry
          Idempotency.deleteOne({ key }).catch((e) => console.error('[Idempotency] Release failed:', e.message));
        }

        return originalJson.call(this, body);
      };

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = { idempotency };
