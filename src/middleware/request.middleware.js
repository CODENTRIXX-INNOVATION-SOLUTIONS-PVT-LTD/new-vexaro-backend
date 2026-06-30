/**
 * src/middleware/request.middleware.js
 *
 * Logs every inbound HTTP request and its response when it finishes.
 * Attaches a unique request ID to each request for log correlation.
 *
 * Logged fields:
 *   requestId, method, url, ip, userAgent,
 *   statusCode, durationMs, userId (if authenticated)
 *
 * Sensitive paths are not body-logged (auth routes, password changes).
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

// Paths where we skip logging the request body (contain passwords / tokens)
const SENSITIVE_PATHS = [
  '/api/auth/login',
  '/api/auth/set-password',
  '/api/auth/reset-password',
  '/api/auth/forgot-password',
  '/api/auth/change-initial-credentials',
  '/api/settings/change-password',
];

const requestMiddleware = (req, res, next) => {
  // Attach a unique request ID so all logs from one request are correlated
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);

  const startedAt = Date.now();

  // Log when response finishes
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const isSensitive = SENSITIVE_PATHS.some(p => req.path.startsWith(p));

    logger.info('http_request', {
      requestId:  req.requestId,
      method:     req.method,
      path:       req.path,
      statusCode: res.statusCode,
      durationMs,
      ip:         req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent:  req.headers['user-agent'] || 'unknown',
      userId:     req.user?.userId || null,
      // Only log body on non-sensitive, non-GET routes for debugging
      ...(
        !isSensitive &&
        req.method !== 'GET' &&
        process.env.NODE_ENV === 'development'
          ? { body: req.body }
          : {}
      ),
    });
  });

  next();
};

module.exports = { requestMiddleware };
