const { env } = require('../config/env');
const { ZodError } = require('zod/v4');
const { formatZodError } = require('../utils/errors');
const logger = require('../utils/logger');

const errorMiddleware = (err, req, res, _next) => {
  // Log unhandled error
  logger.error('unhandled_error', {
    requestId:  req?.requestId || null,
    method:     req?.method,
    path:       req?.path,
    statusCode: err.statusCode || 500,
    errorName:  err.name,
    message:    err.message,
    stack:      env.NODE_ENV !== 'production' ? err.stack : undefined,
    userId:     req?.user?.userId || null,
  });

  const baseResponse = {
    success: false,
    requestId: req?.requestId || null,
    timestamp: new Date().toISOString(),
  };

  // 1. Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      ...baseResponse,
      message: 'Validation failed',
      error: 'ValidationError',
      errors: err.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  // 2. Custom validation errors with embedded field list
  if (err.name === 'ValidationError' || err.message === 'Validation failed') {
    return res.status(400).json({
      ...baseResponse,
      message: err.message || 'Validation failed',
      error: 'ValidationError',
      errors: err.errors || [],
    });
  }

  // 4. Mongo Duplicate Key Errors (Conflict)
  if (err.code === 11000 && err.keyValue) {
    const field = Object.keys(err.keyValue)[0];
    const message = env.NODE_ENV === 'production'
      ? 'A resource conflict occurred. The value for a unique field already exists.'
      : `${field} already exists`;
    return res.status(409).json({
      ...baseResponse,
      message,
      error: 'ConflictError',
    });
  }

  // 5. JWT Validation Errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      ...baseResponse,
      message: 'Invalid token',
      error: 'UnauthorizedError',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      ...baseResponse,
      message: 'Token expired. Please sign in again.',
      error: 'UnauthorizedError',
    });
  }

  // 6. Default business / server errors
  const statusCode = err.statusCode || 500;
  const message =
    env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message || 'Internal server error';

  return res.status(statusCode).json({
    ...baseResponse,
    message,
    error: err.name || 'InternalServerError',
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { errorMiddleware };
