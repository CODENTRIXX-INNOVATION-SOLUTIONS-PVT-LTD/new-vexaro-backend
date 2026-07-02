const { ZodError } = require('zod/v4');

/**
 * Standard Zod validation error formatter
 */
const formatZodError = (error) => {
  if (error instanceof ZodError) {
    return error.issues.map((i) => i.message).join(', ');
  }
  return error.message;
};

/**
 * Helper to build/enrich error objects with custom status codes
 */
const createAppError = (message, statusCode = 500) => {
  return Object.assign(new Error(message), { statusCode });
};

/**
 * Express async controller handler wrapper
 */
const wrapController = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    next(error);
  }
};

const asyncHandler = wrapController;
const withErrorHandling = wrapController;

module.exports = {
  formatZodError,
  createAppError,
  wrapController,
  asyncHandler,
  withErrorHandling,
};
