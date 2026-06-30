'use strict';

const fc = require('fast-check');
const { ZodError } = require('zod/v4');
const { z } = require('zod/v4');
const { errorMiddleware } = require('../../src/middleware/error.middleware');
const { mockRes } = require('../helpers/mockRes');
const { mockReq } = require('../helpers/mockReq');

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
  },
}));

const logger = require('../../src/utils/logger');

describe('errorMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockReq({ requestId: 'test-request-id', method: 'POST', path: '/api/test' });
    res = mockRes();
    next = jest.fn();
  });

  // ---------------------------------------------------------------------------
  // R14.1: ZodError → 400 with ValidationError and errors array
  // ---------------------------------------------------------------------------
  describe('ZodError handling', () => {
    it('returns 400 with ValidationError and non-empty errors array for ZodError', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().positive(),
      });

      let zodError;
      try {
        schema.parse({ email: 'invalid-email', age: -5 });
      } catch (err) {
        zodError = err;
      }

      errorMiddleware(zodError, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Validation failed',
          error: 'ValidationError',
          errors: expect.any(Array),
          requestId: 'test-request-id',
          timestamp: expect.any(String),
        })
      );

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.errors.length).toBeGreaterThan(0);
      expect(jsonCall.errors[0]).toHaveProperty('field');
      expect(jsonCall.errors[0]).toHaveProperty('message');
    });

    it('logs the error with correct metadata for ZodError', () => {
      const schema = z.object({ name: z.string() });
      let zodError;
      try {
        schema.parse({ name: 123 });
      } catch (err) {
        zodError = err;
      }

      errorMiddleware(zodError, req, res, next);

      expect(logger.error).toHaveBeenCalledWith(
        'unhandled_error',
        expect.objectContaining({
          requestId: 'test-request-id',
          method: 'POST',
          path: '/api/test',
          errorName: 'ZodError',
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // R14.2: ValidationError name → 400
  // ---------------------------------------------------------------------------
  describe('ValidationError name handling', () => {
    it('returns 400 with ValidationError for error.name = ValidationError', () => {
      const err = new Error('Invalid input');
      err.name = 'ValidationError';
      err.errors = [{ field: 'username', message: 'Username is required' }];

      errorMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Invalid input',
          error: 'ValidationError',
          errors: [{ field: 'username', message: 'Username is required' }],
          requestId: 'test-request-id',
          timestamp: expect.any(String),
        })
      );
    });

    it('returns 400 for error with message "Validation failed"', () => {
      const err = new Error('Validation failed');
      err.errors = [];

      errorMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Validation failed',
          error: 'ValidationError',
          errors: [],
        })
      );
    });

    it('uses empty errors array when err.errors is not provided', () => {
      const err = new Error('Validation failed');
      err.name = 'ValidationError';

      errorMiddleware(err, req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.errors).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // R14.3: Mongo dup key (code=11000) → 409 ConflictError
  // ---------------------------------------------------------------------------
  describe('MongoDB duplicate key error handling', () => {
    it('returns 409 with ConflictError for Mongo duplicate key error (code 11000)', () => {
      const err = new Error('E11000 duplicate key error');
      err.code = 11000;
      err.keyValue = { email: 'test@example.com' };

      errorMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'ConflictError',
          requestId: 'test-request-id',
          timestamp: expect.any(String),
        })
      );
    });

    it('includes field name in message for duplicate key error in test environment', () => {
      const err = new Error('E11000 duplicate key error');
      err.code = 11000;
      err.keyValue = { username: 'john_doe' };

      errorMiddleware(err, req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.message).toContain('username');
      expect(jsonCall.message).toContain('already exists');
    });
  });

  // ---------------------------------------------------------------------------
  // R14.4: JsonWebTokenError → 401
  // ---------------------------------------------------------------------------
  describe('JsonWebTokenError handling', () => {
    it('returns 401 with UnauthorizedError for JsonWebTokenError', () => {
      const err = new Error('invalid signature');
      err.name = 'JsonWebTokenError';

      errorMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Invalid token',
          error: 'UnauthorizedError',
          requestId: 'test-request-id',
          timestamp: expect.any(String),
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // R14.5: TokenExpiredError → 401
  // ---------------------------------------------------------------------------
  describe('TokenExpiredError handling', () => {
    it('returns 401 with UnauthorizedError for TokenExpiredError', () => {
      const err = new Error('jwt expired');
      err.name = 'TokenExpiredError';

      errorMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Token expired. Please sign in again.',
          error: 'UnauthorizedError',
          requestId: 'test-request-id',
          timestamp: expect.any(String),
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // R14.6: Generic error with custom statusCode
  // ---------------------------------------------------------------------------
  describe('Generic error with custom statusCode', () => {
    it('returns the exact custom statusCode from error object', () => {
      const err = new Error('Resource not found');
      err.statusCode = 404;

      errorMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Resource not found',
          error: 'Error',
          requestId: 'test-request-id',
          timestamp: expect.any(String),
        })
      );
    });

    it('returns 403 for custom forbidden error', () => {
      const err = new Error('Access denied');
      err.statusCode = 403;
      err.name = 'ForbiddenError';

      errorMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Access denied',
          error: 'ForbiddenError',
        })
      );
    });

    it('defaults to 500 when statusCode is not provided', () => {
      const err = new Error('Unexpected error');

      errorMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Unexpected error',
          error: 'Error',
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // R14.7: All responses include success:false, requestId, timestamp
  // ---------------------------------------------------------------------------
  describe('Response structure invariants', () => {
    it('always includes success:false in response body', () => {
      const err = new Error('Test error');
      err.statusCode = 418;

      errorMiddleware(err, req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.success).toBe(false);
    });

    it('always includes requestId in response body', () => {
      const err = new Error('Test error');

      errorMiddleware(err, req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall).toHaveProperty('requestId');
      expect(jsonCall.requestId).toBe('test-request-id');
    });

    it('includes requestId as null when req.requestId is missing', () => {
      const err = new Error('Test error');
      req.requestId = null;

      errorMiddleware(err, req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.requestId).toBe(null);
    });

    it('always includes timestamp in ISO 8601 format', () => {
      const err = new Error('Test error');

      errorMiddleware(err, req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall).toHaveProperty('timestamp');
      expect(typeof jsonCall.timestamp).toBe('string');
      // Validate ISO 8601 format
      expect(() => new Date(jsonCall.timestamp)).not.toThrow();
      expect(new Date(jsonCall.timestamp).toISOString()).toBe(jsonCall.timestamp);
    });

    it('includes all three invariant fields for any error type', () => {
      const errorTypes = [
        { error: new Error('Generic'), expectedStatus: 500 },
        { error: Object.assign(new Error('Custom'), { statusCode: 422 }), expectedStatus: 422 },
        { error: Object.assign(new Error('Not found'), { statusCode: 404 }), expectedStatus: 404 },
      ];

      errorTypes.forEach(({ error }) => {
        jest.clearAllMocks();
        const freshRes = mockRes();

        errorMiddleware(error, req, freshRes, next);

        const jsonCall = freshRes.json.mock.calls[0][0];
        expect(jsonCall.success).toBe(false);
        expect(jsonCall).toHaveProperty('requestId');
        expect(jsonCall).toHaveProperty('timestamp');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // R14.8: PBT - statusCode passthrough invariant
  // **Validates: Requirements R14**
  // ---------------------------------------------------------------------------
  describe('Property-Based Test: statusCode passthrough', () => {
    it('any error with numeric statusCode in [400, 599] produces response with same status code and success === false', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 400, max: 599 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (statusCode, message) => {
            jest.clearAllMocks();
            const freshReq = mockReq({ requestId: 'pbt-request-id' });
            const freshRes = mockRes();
            const freshNext = jest.fn();

            const err = new Error(message);
            err.statusCode = statusCode;

            errorMiddleware(err, freshReq, freshRes, freshNext);

            // Assert status code matches exactly
            expect(freshRes.status).toHaveBeenCalledWith(statusCode);

            // Assert success is false
            const jsonCall = freshRes.json.mock.calls[0][0];
            expect(jsonCall.success).toBe(false);

            // Return true for fc.assert
            return (
              freshRes.status.mock.calls[0][0] === statusCode &&
              jsonCall.success === false
            );
          }
        ),
        { numRuns: 200 }
      );
    });

    it('PBT: all client errors (4xx) include success:false', () => {
      fc.assert(
        fc.property(fc.integer({ min: 400, max: 499 }), (statusCode) => {
          jest.clearAllMocks();
          const freshReq = mockReq({ requestId: 'pbt-4xx' });
          const freshRes = mockRes();

          const err = new Error('Client error');
          err.statusCode = statusCode;

          errorMiddleware(err, freshReq, freshRes, jest.fn());

          const jsonCall = freshRes.json.mock.calls[0][0];
          return jsonCall.success === false && freshRes.status.mock.calls[0][0] === statusCode;
        }),
        { numRuns: 100 }
      );
    });

    it('PBT: all server errors (5xx) include success:false', () => {
      fc.assert(
        fc.property(fc.integer({ min: 500, max: 599 }), (statusCode) => {
          jest.clearAllMocks();
          const freshReq = mockReq({ requestId: 'pbt-5xx' });
          const freshRes = mockRes();

          const err = new Error('Server error');
          err.statusCode = statusCode;

          errorMiddleware(err, freshReq, freshRes, jest.fn());

          const jsonCall = freshRes.json.mock.calls[0][0];
          return jsonCall.success === false && freshRes.status.mock.calls[0][0] === statusCode;
        }),
        { numRuns: 100 }
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Additional edge cases
  // ---------------------------------------------------------------------------
  describe('Edge cases', () => {
    it('handles error when req is undefined', () => {
      const err = new Error('Test error');

      // Should not throw
      expect(() => errorMiddleware(err, undefined, res, next)).not.toThrow();

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.requestId).toBe(null);
    });

    it('handles error when req.user is undefined', () => {
      const err = new Error('Test error');
      req.user = undefined;

      errorMiddleware(err, req, res, next);

      expect(logger.error).toHaveBeenCalledWith(
        'unhandled_error',
        expect.objectContaining({
          userId: null,
        })
      );
    });

    it('logs userId when available', () => {
      const err = new Error('Test error');
      req.user = { userId: 'user-123' };

      errorMiddleware(err, req, res, next);

      expect(logger.error).toHaveBeenCalledWith(
        'unhandled_error',
        expect.objectContaining({
          userId: 'user-123',
        })
      );
    });

    it('uses error.name in response when available', () => {
      const err = new Error('Custom error occurred');
      err.name = 'CustomError';
      err.statusCode = 422;

      errorMiddleware(err, req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.error).toBe('CustomError');
    });

    it('defaults error name to InternalServerError when not provided', () => {
      const err = new Error('Generic error');
      err.name = '';

      errorMiddleware(err, req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.error).toBe('InternalServerError');
    });
  });
});
