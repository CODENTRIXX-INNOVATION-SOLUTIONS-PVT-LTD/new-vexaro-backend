'use strict';

const { idempotency } = require('../../src/middleware/idempotency.middleware');
const { mockRes } = require('../helpers/mockRes');
const { mockReq } = require('../helpers/mockReq');

// Mock Idempotency model
jest.mock('../../src/modules/finance/idempotency.model', () => ({
  Idempotency: {
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

const { Idempotency } = require('../../src/modules/finance/idempotency.model');

describe('idempotency middleware', () => {
  let req, res, next, middleware;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockReq({ requestId: 'test-request-id' });
    res = mockRes();
    next = jest.fn();
    middleware = idempotency();

    // Suppress console.error for expected error handling
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // R16.1: No X-Idempotency-Key header → next() immediately
  // ---------------------------------------------------------------------------
  describe('No idempotency key provided', () => {
    it('calls next() immediately when X-Idempotency-Key header is missing', async () => {
      req.headers = {};

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(Idempotency.findOne).not.toHaveBeenCalled();
      expect(Idempotency.create).not.toHaveBeenCalled();
    });

    it('calls next() immediately when X-Idempotency-Key is undefined', async () => {
      req.headers = { 'x-idempotency-key': undefined };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(Idempotency.findOne).not.toHaveBeenCalled();
    });

    it('calls next() immediately when X-Idempotency-Key is null', async () => {
      req.headers = { 'x-idempotency-key': null };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(Idempotency.findOne).not.toHaveBeenCalled();
    });

    it('calls next() immediately when X-Idempotency-Key is empty string', async () => {
      req.headers = { 'x-idempotency-key': '' };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(Idempotency.findOne).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // R16.2: Existing completed record → return cached response
  // ---------------------------------------------------------------------------
  describe('Existing completed record', () => {
    it('returns cached response without calling next() for existing completed record', async () => {
      req.headers = { 'x-idempotency-key': 'test-key-123' };

      const cachedRecord = {
        key: 'test-key-123',
        inFlight: false,
        responseStatus: 200,
        responseBody: {
          success: true,
          message: 'Cached response',
          data: { id: 'cached-123' },
        },
      };

      Idempotency.findOne.mockResolvedValue(cachedRecord);

      await middleware(req, res, next);

      expect(Idempotency.findOne).toHaveBeenCalledWith({ key: 'test-key-123' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Cached response',
        data: { id: 'cached-123' },
      });
      expect(next).not.toHaveBeenCalled();
      expect(Idempotency.create).not.toHaveBeenCalled();
    });

    it('returns cached 201 response for completed create operation', async () => {
      req.headers = { 'x-idempotency-key': 'create-key-456' };

      const cachedRecord = {
        key: 'create-key-456',
        inFlight: false,
        responseStatus: 201,
        responseBody: {
          success: true,
          message: 'Resource created',
          data: { id: 'resource-789' },
        },
      };

      Idempotency.findOne.mockResolvedValue(cachedRecord);

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Resource created',
        data: { id: 'resource-789' },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns cached 4xx error response for completed failed operation', async () => {
      req.headers = { 'x-idempotency-key': 'error-key-789' };

      const cachedRecord = {
        key: 'error-key-789',
        inFlight: false,
        responseStatus: 400,
        responseBody: {
          success: false,
          message: 'Validation error',
          error: 'ValidationError',
        },
      };

      Idempotency.findOne.mockResolvedValue(cachedRecord);

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation error',
        error: 'ValidationError',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // R16.3: In-flight record → 409 ConflictError
  // ---------------------------------------------------------------------------
  describe('In-flight record', () => {
    it('returns 409 ConflictError when key is in-flight', async () => {
      req.headers = { 'x-idempotency-key': 'in-flight-key' };

      const inFlightRecord = {
        key: 'in-flight-key',
        inFlight: true,
      };

      Idempotency.findOne.mockResolvedValue(inFlightRecord);

      await middleware(req, res, next);

      expect(Idempotency.findOne).toHaveBeenCalledWith({ key: 'in-flight-key' });
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Another request with the same idempotency key is already in progress.',
        error: 'ConflictError',
        requestId: 'test-request-id',
        timestamp: expect.any(String),
      });
      expect(next).not.toHaveBeenCalled();
      expect(Idempotency.create).not.toHaveBeenCalled();
    });

    it('includes requestId in conflict response', async () => {
      req.headers = { 'x-idempotency-key': 'conflict-key' };
      req.requestId = 'custom-request-id-999';

      Idempotency.findOne.mockResolvedValue({ key: 'conflict-key', inFlight: true });

      await middleware(req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.requestId).toBe('custom-request-id-999');
    });

    it('includes null requestId when req.requestId is missing', async () => {
      req.headers = { 'x-idempotency-key': 'conflict-key' };
      req.requestId = null;

      Idempotency.findOne.mockResolvedValue({ key: 'conflict-key', inFlight: true });

      await middleware(req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.requestId).toBe(null);
    });

    it('returns ISO 8601 timestamp in conflict response', async () => {
      req.headers = { 'x-idempotency-key': 'conflict-key' };

      Idempotency.findOne.mockResolvedValue({ key: 'conflict-key', inFlight: true });

      await middleware(req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(() => new Date(jsonCall.timestamp)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // R16.4: New key → create lock and call next()
  // ---------------------------------------------------------------------------
  describe('New key - create lock', () => {
    it('creates lock record and calls next() for new key', async () => {
      req.headers = { 'x-idempotency-key': 'new-key-123' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'new-key-123', inFlight: true });

      await middleware(req, res, next);

      expect(Idempotency.findOne).toHaveBeenCalledWith({ key: 'new-key-123' });
      expect(Idempotency.create).toHaveBeenCalledWith({ key: 'new-key-123', inFlight: true });
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
      // res.json is intercepted so we can't check if it was called as a mock
    });

    it('intercepts res.json for new key to cache response later', async () => {
      req.headers = { 'x-idempotency-key': 'new-key-456' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'new-key-456', inFlight: true });

      await middleware(req, res, next);

      // res.json should be replaced with interceptor
      expect(typeof res.json).toBe('function');
      expect(res.json).not.toBe(mockRes().json);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // R16.5: Concurrent duplicate key error (code=11000) → 409
  // ---------------------------------------------------------------------------
  describe('Concurrent duplicate key error', () => {
    it('returns 409 when Idempotency.create throws duplicate key error (code 11000)', async () => {
      req.headers = { 'x-idempotency-key': 'concurrent-key' };

      Idempotency.findOne.mockResolvedValue(null);

      const duplicateError = new Error('E11000 duplicate key error');
      duplicateError.code = 11000;
      Idempotency.create.mockRejectedValue(duplicateError);

      await middleware(req, res, next);

      expect(Idempotency.findOne).toHaveBeenCalledWith({ key: 'concurrent-key' });
      expect(Idempotency.create).toHaveBeenCalledWith({ key: 'concurrent-key', inFlight: true });
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Another request with the same idempotency key is already in progress.',
        error: 'ConflictError',
        requestId: 'test-request-id',
        timestamp: expect.any(String),
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('includes requestId in duplicate key conflict response', async () => {
      req.headers = { 'x-idempotency-key': 'dup-key' };
      req.requestId = 'dup-request-999';

      Idempotency.findOne.mockResolvedValue(null);

      const dupError = new Error('E11000');
      dupError.code = 11000;
      Idempotency.create.mockRejectedValue(dupError);

      await middleware(req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.requestId).toBe('dup-request-999');
    });

    it('re-throws non-duplicate-key errors from Idempotency.create', async () => {
      req.headers = { 'x-idempotency-key': 'error-key' };

      Idempotency.findOne.mockResolvedValue(null);

      const genericError = new Error('Database connection error');
      genericError.code = 'ECONNREFUSED';
      Idempotency.create.mockRejectedValue(genericError);

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(genericError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // R16.6: 2xx–4xx response → update idempotency record
  // ---------------------------------------------------------------------------
  describe('2xx–4xx response caching', () => {
    it('updates idempotency record with inFlight:false for 2xx response', async () => {
      req.headers = { 'x-idempotency-key': 'success-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'success-key', inFlight: true });
      Idempotency.findOneAndUpdate.mockResolvedValue({});

      await middleware(req, res, next);

      // Simulate controller calling res.json with 200 response
      res.statusCode = 200;
      const responseBody = { success: true, message: 'Success', data: { id: '123' } };
      res.json(responseBody);

      expect(Idempotency.findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'success-key' },
        {
          inFlight: false,
          responseStatus: 200,
          responseBody: responseBody,
        }
      );
    });

    it('updates idempotency record for 201 created response', async () => {
      req.headers = { 'x-idempotency-key': 'created-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'created-key', inFlight: true });
      Idempotency.findOneAndUpdate.mockResolvedValue({});

      await middleware(req, res, next);

      res.statusCode = 201;
      const responseBody = { success: true, message: 'Created', data: { id: '456' } };
      res.json(responseBody);

      expect(Idempotency.findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'created-key' },
        {
          inFlight: false,
          responseStatus: 201,
          responseBody: responseBody,
        }
      );
    });

    it('updates idempotency record for 400 validation error response', async () => {
      req.headers = { 'x-idempotency-key': 'validation-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'validation-key', inFlight: true });
      Idempotency.findOneAndUpdate.mockResolvedValue({});

      await middleware(req, res, next);

      res.statusCode = 400;
      const responseBody = { success: false, message: 'Validation failed', error: 'ValidationError' };
      res.json(responseBody);

      expect(Idempotency.findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'validation-key' },
        {
          inFlight: false,
          responseStatus: 400,
          responseBody: responseBody,
        }
      );
    });

    it('updates idempotency record for 404 not found response', async () => {
      req.headers = { 'x-idempotency-key': 'notfound-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'notfound-key', inFlight: true });
      Idempotency.findOneAndUpdate.mockResolvedValue({});

      await middleware(req, res, next);

      res.statusCode = 404;
      const responseBody = { success: false, message: 'Not found' };
      res.json(responseBody);

      expect(Idempotency.findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'notfound-key' },
        {
          inFlight: false,
          responseStatus: 404,
          responseBody: responseBody,
        }
      );
    });

    it('updates idempotency record for 409 conflict response', async () => {
      req.headers = { 'x-idempotency-key': 'conflict-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'conflict-key', inFlight: true });
      Idempotency.findOneAndUpdate.mockResolvedValue({});

      await middleware(req, res, next);

      res.statusCode = 409;
      const responseBody = { success: false, message: 'Conflict', error: 'ConflictError' };
      res.json(responseBody);

      expect(Idempotency.findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'conflict-key' },
        {
          inFlight: false,
          responseStatus: 409,
          responseBody: responseBody,
        }
      );
    });

    it('still calls original res.json and returns response to client', async () => {
      req.headers = { 'x-idempotency-key': 'return-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'return-key', inFlight: true });
      Idempotency.findOneAndUpdate.mockResolvedValue({});

      const originalJson = jest.fn().mockReturnValue(res);
      res.json = originalJson;

      await middleware(req, res, next);

      res.statusCode = 200;
      const responseBody = { success: true, data: 'test' };
      res.json(responseBody);

      // Original json should still be called
      expect(originalJson).toHaveBeenCalledWith(responseBody);
    });

    it('does not throw if findOneAndUpdate fails (non-fatal)', async () => {
      req.headers = { 'x-idempotency-key': 'fail-update-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'fail-update-key', inFlight: true });
      Idempotency.findOneAndUpdate.mockRejectedValue(new Error('Database error'));

      await middleware(req, res, next);

      res.statusCode = 200;
      const responseBody = { success: true };

      // Should not throw
      expect(() => res.json(responseBody)).not.toThrow();
      
      // Wait for async catch block to execute
      await new Promise(resolve => setImmediate(resolve));
      
      expect(console.error).toHaveBeenCalledWith(
        '[Idempotency] Save failed:',
        'Database error'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // R16.7: 5xx response → delete idempotency record for retry
  // ---------------------------------------------------------------------------
  describe('5xx response - delete record for retry', () => {
    it('deletes idempotency record for 500 server error', async () => {
      req.headers = { 'x-idempotency-key': 'server-error-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'server-error-key', inFlight: true });
      Idempotency.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await middleware(req, res, next);

      res.statusCode = 500;
      const responseBody = { success: false, message: 'Internal server error' };
      res.json(responseBody);

      expect(Idempotency.deleteOne).toHaveBeenCalledWith({ key: 'server-error-key' });
      expect(Idempotency.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('deletes idempotency record for 502 bad gateway', async () => {
      req.headers = { 'x-idempotency-key': 'bad-gateway-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'bad-gateway-key', inFlight: true });
      Idempotency.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await middleware(req, res, next);

      res.statusCode = 502;
      const responseBody = { success: false, message: 'Bad gateway' };
      res.json(responseBody);

      expect(Idempotency.deleteOne).toHaveBeenCalledWith({ key: 'bad-gateway-key' });
      expect(Idempotency.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('deletes idempotency record for 503 service unavailable', async () => {
      req.headers = { 'x-idempotency-key': 'unavailable-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'unavailable-key', inFlight: true });
      Idempotency.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await middleware(req, res, next);

      res.statusCode = 503;
      const responseBody = { success: false, message: 'Service unavailable' };
      res.json(responseBody);

      expect(Idempotency.deleteOne).toHaveBeenCalledWith({ key: 'unavailable-key' });
    });

    it('deletes idempotency record for 504 gateway timeout', async () => {
      req.headers = { 'x-idempotency-key': 'timeout-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'timeout-key', inFlight: true });
      Idempotency.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await middleware(req, res, next);

      res.statusCode = 504;
      const responseBody = { success: false, message: 'Gateway timeout' };
      res.json(responseBody);

      expect(Idempotency.deleteOne).toHaveBeenCalledWith({ key: 'timeout-key' });
    });

    it('still calls original res.json for 5xx errors', async () => {
      req.headers = { 'x-idempotency-key': 'error-return-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'error-return-key', inFlight: true });
      Idempotency.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const originalJson = jest.fn().mockReturnValue(res);
      res.json = originalJson;

      await middleware(req, res, next);

      res.statusCode = 500;
      const responseBody = { success: false, message: 'Error' };
      res.json(responseBody);

      expect(originalJson).toHaveBeenCalledWith(responseBody);
    });

    it('does not throw if deleteOne fails (non-fatal)', async () => {
      req.headers = { 'x-idempotency-key': 'fail-delete-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'fail-delete-key', inFlight: true });
      Idempotency.deleteOne.mockRejectedValue(new Error('Delete failed'));

      await middleware(req, res, next);

      res.statusCode = 500;
      const responseBody = { success: false };

      // Should not throw
      expect(() => res.json(responseBody)).not.toThrow();
      
      // Wait for async catch block to execute
      await new Promise(resolve => setImmediate(resolve));
      
      expect(console.error).toHaveBeenCalledWith(
        '[Idempotency] Release failed:',
        'Delete failed'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases and boundary conditions
  // ---------------------------------------------------------------------------
  describe('Edge cases', () => {
    it('handles 3xx redirect responses by updating record (not 5xx)', async () => {
      req.headers = { 'x-idempotency-key': 'redirect-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'redirect-key', inFlight: true });
      Idempotency.findOneAndUpdate.mockResolvedValue({});

      await middleware(req, res, next);

      res.statusCode = 301;
      const responseBody = { success: true, location: '/new-location' };
      res.json(responseBody);

      expect(Idempotency.findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'redirect-key' },
        {
          inFlight: false,
          responseStatus: 301,
          responseBody: responseBody,
        }
      );
      expect(Idempotency.deleteOne).not.toHaveBeenCalled();
    });

    it('handles status code 199 (edge of 1xx range) - deletes record (not cached)', async () => {
      req.headers = { 'x-idempotency-key': 'edge-199-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'edge-199-key', inFlight: true });
      Idempotency.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await middleware(req, res, next);

      res.statusCode = 199;
      const responseBody = { success: true };
      res.json(responseBody);

      // Status code 199 is < 200, so it's treated like a server error and deleted
      expect(Idempotency.deleteOne).toHaveBeenCalledWith({ key: 'edge-199-key' });
      expect(Idempotency.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('handles status code 499 (edge of 4xx range) by updating record', async () => {
      req.headers = { 'x-idempotency-key': 'edge-499-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'edge-499-key', inFlight: true });
      Idempotency.findOneAndUpdate.mockResolvedValue({});

      await middleware(req, res, next);

      res.statusCode = 499;
      const responseBody = { success: false };
      res.json(responseBody);

      expect(Idempotency.findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'edge-499-key' },
        {
          inFlight: false,
          responseStatus: 499,
          responseBody: responseBody,
        }
      );
      expect(Idempotency.deleteOne).not.toHaveBeenCalled();
    });

    it('handles status code 599 (edge of 5xx range) by deleting record', async () => {
      req.headers = { 'x-idempotency-key': 'edge-599-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'edge-599-key', inFlight: true });
      Idempotency.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await middleware(req, res, next);

      res.statusCode = 599;
      const responseBody = { success: false };
      res.json(responseBody);

      expect(Idempotency.deleteOne).toHaveBeenCalledWith({ key: 'edge-599-key' });
      expect(Idempotency.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('handles generic database error from findOne by passing to next()', async () => {
      req.headers = { 'x-idempotency-key': 'db-error-key' };

      const dbError = new Error('Database connection lost');
      Idempotency.findOne.mockRejectedValue(dbError);

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('preserves original res.json context when intercepting', async () => {
      req.headers = { 'x-idempotency-key': 'context-key' };

      Idempotency.findOne.mockResolvedValue(null);
      Idempotency.create.mockResolvedValue({ key: 'context-key', inFlight: true });
      Idempotency.findOneAndUpdate.mockResolvedValue({});

      await middleware(req, res, next);

      res.statusCode = 200;
      const responseBody = { success: true };

      // Store the original json for testing
      const interceptedJson = res.json;

      // Call intercepted json
      const result = interceptedJson.call(res, responseBody);

      // Should return res for chaining
      expect(result).toBe(res);
    });
  });
});
