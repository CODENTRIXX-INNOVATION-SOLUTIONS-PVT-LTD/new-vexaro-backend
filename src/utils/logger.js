/**
 * src/utils/logger.js
 *
 * Structured JSON logger for Vexaro backend.
 * Uses Winston with two transports:
 *   - Console  : colourised in development, JSON in production
 *   - File     : JSON lines in logs/app.log (rotated daily)
 *
 * Usage (import this single logger everywhere):
 *   const logger = require('./logger');    // from utils/
 *   const logger = require('../../utils/logger');  // from a module
 *
 *   logger.info('User logged in', { userId, email, ip });
 *   logger.warn('Velocity sync failed',  { merchantId, error: err.message });
 *   logger.error('Unhandled error',      { error: err.message, stack: err.stack });
 */

const winston = require('winston');
const path    = require('path');
const fs      = require('fs');

// Ensure the logs directory exists at project root
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const maskSensitiveData = winston.format((info) => {
  const maskString = (str) => {
    if (!str || typeof str !== 'string') return str;
    if (str.length <= 4) return '****';
    return str.slice(0, 2) + '****' + str.slice(-2);
  };
  
  const maskEmail = (email) => {
    if (!email || typeof email !== 'string') return email;
    const parts = email.split('@');
    if (parts.length !== 2) return maskString(email);
    return maskString(parts[0]) + '@' + parts[1];
  };

  const recursiveMask = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        recursiveMask(obj[key]);
      } else {
        const lowerKey = key.toLowerCase();
        if (['password', 'pass', 'jwt', 'token', 'secret', 'apikey', 'key', 'refresh_token', 'invite_token', 'reset_token', 'signature'].some(s => lowerKey.includes(s))) {
          obj[key] = '[REDACTED_SENSITIVE]';
        } else if (lowerKey.includes('email')) {
          obj[key] = maskEmail(obj[key]);
        } else if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
          obj[key] = maskString(obj[key]);
        } else if (['address', 'addressline', 'street', 'city', 'state', 'pincode'].some(s => lowerKey.includes(s))) {
          obj[key] = '[REDACTED_PII]';
        }
      }
    }
  };

  recursiveMask(info);
  return info;
});

// ─── Dev-friendly console format ─────────────────────────────────────────────
const devFormat = combine(
  maskSensitiveData(),
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${ts} [${level}] ${message}${metaStr}`;
  }),
);

// ─── Production JSON format ───────────────────────────────────────────────────
const prodFormat = combine(
  maskSensitiveData(),
  timestamp(),
  errors({ stack: true }),
  json(),
);

const isProduction = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  defaultMeta: { service: 'vexaro-api' },
  transports: [
    // Console — always on
    new winston.transports.Console({
      format: isProduction ? prodFormat : devFormat,
    }),
    // File — always on, structured JSON
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      format:   prodFormat,
      maxsize:  10 * 1024 * 1024,  // 10 MB per file
      maxFiles: 7,                  // keep 7 rotated files (~70 MB total)
      tailable: true,
    }),
    // Separate error-only file for fast incident triage
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level:    'error',
      format:   prodFormat,
      maxsize:  10 * 1024 * 1024,
      maxFiles: 7,
      tailable: true,
    }),
  ],
  // Catch unhandled rejections and exceptions through the logger
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format:   prodFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format:   prodFormat,
    }),
  ],
});

module.exports = logger;
