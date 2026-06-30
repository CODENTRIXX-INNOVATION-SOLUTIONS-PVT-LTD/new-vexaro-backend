'use strict';

const { sanitizeObject } = require('../sanitizers/string.sanitizer');

function replaceRequestProperty(req, property, value) {
  try {
    req[property] = value;
    if (req[property] !== value) {
      Object.defineProperty(req, property, { configurable: true, enumerable: true, writable: true, value });
    }
  } catch {
    Object.defineProperty(req, property, { configurable: true, enumerable: true, writable: true, value });
  }
}

function sanitizeMiddleware(options = {}) {
  return function sanitizeRequest(req, _res, next) {
    try {
      for (const target of ['body', 'query', 'params']) {
        if (req[target] !== undefined) replaceRequestProperty(req, target, sanitizeObject(req[target], options));
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { sanitizeMiddleware, replaceRequestProperty };
