'use strict';

const { requestMiddleware } = require('../../src/middleware/request.middleware');
const { mockRes } = require('../helpers/mockRes');
const { mockReq } = require('../helpers/mockReq');

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const logger = require('../../src/utils/logger');

describe('requestMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockReq();
    res = mockRes();
    next = jest.fn();
  });

  // ---------------------------------------------------------------------------
  // R15.1: requestId UUID v4 format and X-Request-Id header
  // ---------------------------------------------------------------------------
  describe('requestId attachment and header', () => {
    it('attaches a UUID-formatted requestId to req', () => {
      requestMiddleware(req, res, next);

      expect(req.requestId).toBeDefined();
      expect(typeof req.requestId).toBe('string');
      
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (36 chars total)
      const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(req.requestId).toMatch(uuidv4Regex);
    });

    it('sets X-Request-Id header on response to same value as req.requestId', () => {
      requestMiddleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
      expect(res.setHeader.mock.calls[0][1]).toBe(req.requestId);
    });

    it('requestId is exactly 36 characters long (UUID v4 format with dashes)', () => {
      requestMiddleware(req, res, next);

      expect(req.requestId).toHaveLength(36);
      // Verify dashes are in correct positions (8-4-4-4-12 pattern)
      expect(req.requestId[8]).toBe('-');
      expect(req.requestId[13]).toBe('-');
      expect(req.requestId[18]).toBe('-');
      expect(req.requestId[23]).toBe('-');
    });

    it('calls next() after attaching requestId', () => {
      requestMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it('generates unique requestIds for different requests', () => {
      const req1 = mockReq();
      const req2 = mockReq();
      const res1 = mockRes();
      const res2 = mockRes();

      requestMiddleware(req1, res1, jest.fn());
      requestMiddleware(req2, res2, jest.fn());

      expect(req1.requestId).not.toBe(req2.requestId);
    });
  });

  // ---------------------------------------------------------------------------
  // R15.2: Sensitive path suppresses body in log
  // ---------------------------------------------------------------------------
  describe('sensitive path body suppression', () => {
    const sensitivePaths = [
      '/api/auth/login',
      '/api/auth/set-password',
      '/api/auth/reset-password',
      '/api/auth/forgot-password',
      '/api/auth/change-initial-credentials',
      '/api/settings/change-password',
    ];

    sensitivePaths.forEach((path) => {
      it(`does not include body in log payload for sensitive path: ${path}`, () => {
        req = mockReq({
          method: 'POST',
          path,
          body: { password: 'secret123', email: 'user@example.com' },
        });
        process.env.NODE_ENV = 'development';

        requestMiddleware(req, res, next);

        // Trigger the 'finish' event
        const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
        finishCallback();

        expect(logger.info).toHaveBeenCalledTimes(1);
        const logCall = logger.info.mock.calls[0];
        const logPayload = logCall[1];

        // Assert body is NOT included
        expect(logPayload).not.toHaveProperty('body');
      });
    });

    it('suppresses body for path starting with sensitive path prefix', () => {
      req = mockReq({
        method: 'POST',
        path: '/api/auth/login/admin',
        body: { password: 'admin-secret' },
      });
      process.env.NODE_ENV = 'development';

      requestMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      const logPayload = logger.info.mock.calls[0][1];
      expect(logPayload).not.toHaveProperty('body');
    });

    it('includes body for non-sensitive path in development', () => {
      req = mockReq({
        method: 'POST',
        path: '/api/shipments',
        body: { weight: 5, destination: 'Mumbai' },
      });
      process.env.NODE_ENV = 'development';

      requestMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      const logPayload = logger.info.mock.calls[0][1];
      expect(logPayload).toHaveProperty('body');
      expect(logPayload.body).toEqual({ weight: 5, destination: 'Mumbai' });
    });
  });

  // ---------------------------------------------------------------------------
  // R15.3: Non-sensitive POST in dev environment includes body in log
  // ---------------------------------------------------------------------------
  describe('body logging in development environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('includes body in log payload for non-sensitive POST request in development', () => {
      req = mockReq({
        method: 'POST',
        path: '/api/shipments',
        body: { origin: 'Delhi', destination: 'Mumbai', weight: 10 },
      });

      requestMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      expect(logger.info).toHaveBeenCalledWith(
        'http_request',
        expect.objectContaining({
          body: { origin: 'Delhi', destination: 'Mumbai', weight: 10 },
        })
      );
    });

    it('includes body for PUT request in development', () => {
      req = mockReq({
        method: 'PUT',
        path: '/api/users/123',
        body: { name: 'John Doe', role: 'MERCHANT' },
      });

      requestMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      const logPayload = logger.info.mock.calls[0][1];
      expect(logPayload).toHaveProperty('body');
      expect(logPayload.body).toEqual({ name: 'John Doe', role: 'MERCHANT' });
    });

    it('includes body for PATCH request in development', () => {
      req = mockReq({
        method: 'PATCH',
        path: '/api/disputes/456',
        body: { status: 'RESOLVED' },
      });

      requestMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      const logPayload = logger.info.mock.calls[0][1];
      expect(logPayload).toHaveProperty('body');
      expect(logPayload.body).toEqual({ status: 'RESOLVED' });
    });

    it('does not include body for GET request even in development', () => {
      req = mockReq({
        method: 'GET',
        path: '/api/shipments',
        body: {},
      });

      requestMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      const logPayload = logger.info.mock.calls[0][1];
      expect(logPayload).not.toHaveProperty('body');
    });

    it('includes body for DELETE request in development (non-GET rule)', () => {
      req = mockReq({
        method: 'DELETE',
        path: '/api/users/789',
        body: { reason: 'User requested account deletion' },
      });

      requestMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      const logPayload = logger.info.mock.calls[0][1];
      expect(logPayload).toHaveProperty('body');
      expect(logPayload.body).toEqual({ reason: 'User requested account deletion' });
    });

    it('does not include body in production environment even for POST', () => {
      process.env.NODE_ENV = 'production';
      req = mockReq({
        method: 'POST',
        path: '/api/shipments',
        body: { origin: 'Delhi', destination: 'Mumbai' },
      });

      requestMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      const logPayload = logger.info.mock.calls[0][1];
      expect(logPayload).not.toHaveProperty('body');
    });

    it('does not include body in test environment even for POST', () => {
      process.env.NODE_ENV = 'test';
      req = mockReq({
        method: 'POST',
        path: '/api/shipments',
        body: { origin: 'Delhi', destination: 'Mumbai' },
      });

      requestMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      const logPayload = logger.info.mock.calls[0][1];
      expect(logPayload).not.toHaveProperty('body');
    });
  });

  // ---------------------------------------------------------------------------
  // Request logging verification
  // ---------------------------------------------------------------------------
  describe('request logging', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('logs http_request with correct metadata when response finishes', () => {
      req = mockReq({
        method: 'POST',
        path: '/api/shipments',
        ip: '192.168.1.1',
        headers: { 'user-agent': 'Mozilla/5.0' },
      });
      res.statusCode = 201;

      requestMiddleware(req, res, next);

      // Trigger the 'finish' event
      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      expect(logger.info).toHaveBeenCalledWith(
        'http_request',
        expect.objectContaining({
          requestId: req.requestId,
          method: 'POST',
          path: '/api/shipments',
          statusCode: 201,
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          userId: null,
          durationMs: expect.any(Number),
        })
      );
    });

    it('logs userId when user is authenticated', () => {
      req = mockReq({
        method: 'GET',
        path: '/api/me',
        user: { userId: 'user-123', role: 'MERCHANT' },
      });

      requestMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      const logPayload = logger.info.mock.calls[0][1];
      expect(logPayload.userId).toBe('user-123');
    });

    it('logs userId as null when user is not authenticated', () => {
      req = mockReq({
        method: 'POST',
        path: '/api/auth/login',
        user: null,
      });

      requestMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      const logPayload = logger.info.mock.calls[0][1];
      expect(logPayload.userId).toBe(null);
    });

    it('uses x-forwarded-for header when req.ip is not available', () => {
      req = mockReq({
        method: 'GET',
        path: '/api/test',
        ip: null,
        headers: { 'x-forwarded-for': '203.0.113.1' },
      });

      requestMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      const logPayload = logger.info.mock.calls[0][1];
      expect(logPayload.ip).toBe('203.0.113.1');
    });

    it('defaults to unknown when IP and x-forwarded-for are not available', () => {
      req = mockReq({
        method: 'GET',
        path: '/api/test',
        ip: null,
        headers: {},
      });

      requestMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      const logPayload = logger.info.mock.calls[0][1];
      expect(logPayload.ip).toBe('unknown');
    });

    it('defaults userAgent to unknown when not provided', () => {
      req = mockReq({
        method: 'GET',
        path: '/api/test',
        headers: {},
      });

      requestMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      const logPayload = logger.info.mock.calls[0][1];
      expect(logPayload.userAgent).toBe('unknown');
    });

    it('calculates durationMs correctly', (done) => {
      req = mockReq({ method: 'GET', path: '/api/test' });

      requestMiddleware(req, res, next);

      // Simulate some processing time
      setTimeout(() => {
        const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
        finishCallback();

        const logPayload = logger.info.mock.calls[0][1];
        expect(logPayload.durationMs).toBeGreaterThanOrEqual(10);
        expect(logPayload.durationMs).toBeLessThan(100); // Should complete quickly in tests
        done();
      }, 15);
    });

    it('registers finish event listener on response object', () => {
      requestMiddleware(req, res, next);

      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });
  });

  // ---------------------------------------------------------------------------
  // R15.4: UUID v4 validation
  // ---------------------------------------------------------------------------
  describe('UUID v4 format validation', () => {
    it('requestId is valid UUID v4 with correct version and variant', () => {
      requestMiddleware(req, res, next);

      const requestId = req.requestId;
      
      // Split into segments
      const segments = requestId.split('-');
      expect(segments).toHaveLength(5);
      expect(segments[0]).toHaveLength(8);
      expect(segments[1]).toHaveLength(4);
      expect(segments[2]).toHaveLength(4);
      expect(segments[3]).toHaveLength(4);
      expect(segments[4]).toHaveLength(12);

      // Version check (13th character should be '4')
      expect(requestId[14]).toBe('4');

      // Variant check (17th character should be one of 8, 9, a, b)
      const variantChar = requestId[19].toLowerCase();
      expect(['8', '9', 'a', 'b']).toContain(variantChar);
    });

    it('all segments contain only valid hex characters', () => {
      requestMiddleware(req, res, next);

      const requestId = req.requestId;
      const hexOnlyRegex = /^[0-9a-f-]+$/i;
      
      expect(requestId).toMatch(hexOnlyRegex);
    });

    it('generates 100 unique valid UUID v4 strings', () => {
      const ids = new Set();
      const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      for (let i = 0; i < 100; i++) {
        const freshReq = mockReq();
        const freshRes = mockRes();
        
        requestMiddleware(freshReq, freshRes, jest.fn());
        
        expect(freshReq.requestId).toMatch(uuidv4Regex);
        ids.add(freshReq.requestId);
      }

      // All 100 should be unique
      expect(ids.size).toBe(100);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles missing req.user gracefully', () => {
      req = mockReq({ user: undefined });

      requestMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      const logPayload = logger.info.mock.calls[0][1];
      expect(logPayload.userId).toBe(null);
    });

    it('handles empty body object', () => {
      process.env.NODE_ENV = 'development';
      req = mockReq({
        method: 'POST',
        path: '/api/test',
        body: {},
      });

      requestMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      const logPayload = logger.info.mock.calls[0][1];
      expect(logPayload.body).toEqual({});
    });

    it('handles null body', () => {
      process.env.NODE_ENV = 'development';
      req = mockReq({
        method: 'POST',
        path: '/api/test',
        body: null,
      });

      requestMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      const logPayload = logger.info.mock.calls[0][1];
      expect(logPayload.body).toBe(null);
    });

    it('handles different status codes', () => {
      const statusCodes = [200, 201, 400, 401, 403, 404, 500, 503];

      statusCodes.forEach((statusCode) => {
        jest.clearAllMocks();
        const freshReq = mockReq();
        const freshRes = mockRes();
        freshRes.statusCode = statusCode;

        requestMiddleware(freshReq, freshRes, jest.fn());

        const finishCallback = freshRes.on.mock.calls.find(call => call[0] === 'finish')[1];
        finishCallback();

        const logPayload = logger.info.mock.calls[0][1];
        expect(logPayload.statusCode).toBe(statusCode);
      });
    });
  });
});
