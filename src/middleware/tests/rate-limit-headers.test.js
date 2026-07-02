'use strict';

const { rateLimiter } = require('../rate-limit.middleware');
const { getClient } = require('../../utils/cache');

// Mock Redis client cache
jest.mock('../../utils/cache');

describe('Rate Limiter Middleware Upgrade', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let mockRedis;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      ip: '127.0.0.1',
      originalUrl: '/api/test-route',
      path: '/api/test-route',
    };
    mockRes = {
      set: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();

    mockRedis = {
      incr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
    };
  });

  describe('Memory Fallback (No Redis)', () => {
    beforeEach(() => {
      getClient.mockReturnValue(null);
    });

    test('should set headers and call next on normal request', async () => {
      const middleware = rateLimiter({ windowMs: 1000, max: 2 });
      
      await middleware(mockReq, mockRes, mockNext);
      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Limit', '2');
      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '1');
      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
      expect(mockNext).toHaveBeenCalled();
    });

    test('should return 429 and Retry-After header when limit exceeded', async () => {
      const middleware = rateLimiter({ windowMs: 60000, max: 1 });
      
      // First request (1 hit, remaining 0)
      await middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Second request (2 hits, exceeds limit of 1)
      const secondRes = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      await middleware(mockReq, secondRes, mockNext);
      
      expect(secondRes.status).toHaveBeenCalledWith(429);
      expect(secondRes.set).toHaveBeenCalledWith('Retry-After', expect.any(String));
      expect(secondRes.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
    });
  });

  describe('Redis Path', () => {
    beforeEach(() => {
      getClient.mockReturnValue(mockRedis);
    });

    test('should set headers and call next on normal request', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(59);

      const middleware = rateLimiter({ windowMs: 60000, max: 10 });
      
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockRedis.incr).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
      expect(mockNext).toHaveBeenCalled();
    });

    test('should set Retry-After with Redis TTL when limit exceeded', async () => {
      mockRedis.incr.mockResolvedValue(11);
      mockRedis.ttl.mockResolvedValue(45);

      const middleware = rateLimiter({ windowMs: 60000, max: 10 });
      
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.set).toHaveBeenCalledWith('Retry-After', '45');
      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
    });
  });

  describe('Bypass Roles', () => {
    test('should bypass rate limiting for Super Admin', async () => {
      mockReq.user = { role: 'SUPER_ADMIN', userId: 'sa-1' };
      const middleware = rateLimiter({ windowMs: 60000, max: 1, bypassRoles: ['SUPER_ADMIN'] });

      // First hit
      await middleware(mockReq, mockRes, mockNext);
      // Second hit (would normally trigger 429)
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).not.toHaveBeenCalledWith(429);
      expect(mockNext).toHaveBeenCalledTimes(2);
    });
  });
});
