'use strict';

const { authMiddleware, requireRole, requirePermission } = require('../../src/middleware/auth.middleware');
const { mockRes } = require('../helpers/mockRes');
const { mockReq } = require('../helpers/mockReq');

// Mock dependencies
jest.mock('../../src/utils', () => ({
  verifyJwt: jest.fn(),
}));

jest.mock('../../src/utils/cache', () => ({
  get: jest.fn(),
  set: jest.fn(),
  TTL: { USER_PROFILE: 3600 },
  KEYS: { userProfile: jest.fn((userId) => `vx:user:${userId}`) },
}));

jest.mock('../../src/modules/users/user.model', () => ({
  User: {
    findOne: jest.fn(),
  },
}));

// Mock mongoose and ApiKey model
const mockApiKeyModel = {
  findOne: jest.fn(),
};

jest.mock('mongoose', () => ({
  model: jest.fn((modelName) => {
    if (modelName === 'ApiKey') {
      return mockApiKeyModel;
    }
    return null;
  }),
}));

const { verifyJwt } = require('../../src/utils');
const { get, set, TTL, KEYS } = require('../../src/utils/cache');
const { User } = require('../../src/modules/users/user.model');

describe('authMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockReq({ requestId: 'test-request-id' });
    res = mockRes();
    next = jest.fn();
  });

  // ---------------------------------------------------------------------------
  // R13.1: Valid Bearer JWT + user exists → attach req.user, call next()
  // ---------------------------------------------------------------------------
  describe('Valid Bearer JWT authentication', () => {
    it('attaches req.user with userId, email, role and calls next() for valid JWT with existing user', async () => {
      req.headers.authorization = 'Bearer valid-jwt-token-123';

      const mockPayload = { userId: 'user-123', email: 'test@example.com' };
      const mockUser = {
        _id: { toString: () => 'user-123' },
        email: 'test@example.com',
        role: 'MERCHANT',
        isActive: true,
        deletedAt: null,
      };

      verifyJwt.mockReturnValue(mockPayload);
      get.mockResolvedValue(null); // Cache miss
      User.findOne.mockResolvedValue(mockUser);
      set.mockResolvedValue(undefined);

      await authMiddleware(req, res, next);

      expect(verifyJwt).toHaveBeenCalledWith('valid-jwt-token-123');
      expect(KEYS.userProfile).toHaveBeenCalledWith('user-123');
      expect(User.findOne).toHaveBeenCalledWith({
        _id: 'user-123',
        isActive: true,
        deletedAt: null,
      });
      expect(req.user).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'MERCHANT',
      });
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('uses cached user data when available and skips database query', async () => {
      req.headers.authorization = 'Bearer cached-jwt-token';

      const mockPayload = { userId: 'user-456', email: 'cached@example.com' };
      const cachedUserData = {
        userId: 'user-456',
        email: 'cached@example.com',
        role: 'DISTRIBUTOR',
      };

      verifyJwt.mockReturnValue(mockPayload);
      get.mockResolvedValue(cachedUserData); // Cache hit

      await authMiddleware(req, res, next);

      expect(verifyJwt).toHaveBeenCalledWith('cached-jwt-token');
      expect(get).toHaveBeenCalledWith('vx:user:user-456');
      expect(User.findOne).not.toHaveBeenCalled(); // Should skip DB query
      expect(set).not.toHaveBeenCalled(); // Should not update cache
      expect(req.user).toEqual(cachedUserData);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('caches user data with correct TTL after successful database lookup', async () => {
      req.headers.authorization = 'Bearer new-jwt-token';

      const mockPayload = { userId: 'user-789', email: 'new@example.com' };
      const mockUser = {
        _id: { toString: () => 'user-789' },
        email: 'new@example.com',
        role: 'SUPER_ADMIN',
        isActive: true,
        deletedAt: null,
      };

      verifyJwt.mockReturnValue(mockPayload);
      get.mockResolvedValue(null);
      User.findOne.mockResolvedValue(mockUser);
      set.mockResolvedValue(undefined);

      await authMiddleware(req, res, next);

      expect(set).toHaveBeenCalledWith(
        'vx:user:user-789',
        {
          userId: 'user-789',
          email: 'new@example.com',
          role: 'SUPER_ADMIN',
        },
        TTL.USER_PROFILE
      );
    });
  });

  // ---------------------------------------------------------------------------
  // R13.2: No Authorization header → 401
  // ---------------------------------------------------------------------------
  describe('Missing Authorization header', () => {
    it('returns 401 when Authorization header is missing', async () => {
      req.headers = {}; // No authorization header

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No authorization token provided',
      });
      expect(next).not.toHaveBeenCalled();
      expect(verifyJwt).not.toHaveBeenCalled();
    });

    it('returns 401 when Authorization header is undefined', async () => {
      req.headers.authorization = undefined;

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No authorization token provided',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when Authorization header is null', async () => {
      req.headers.authorization = null;

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No authorization token provided',
      });
    });

    it('returns 401 when Authorization header is empty string', async () => {
      req.headers.authorization = '';

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No authorization token provided',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // R13.3: Malformed Bearer → 401
  // ---------------------------------------------------------------------------
  describe('Malformed Bearer header', () => {
    it('returns 401 when Authorization header does not start with "Bearer "', async () => {
      req.headers.authorization = 'Basic username:password';

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No authorization token provided',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when token is missing after "Bearer " prefix', async () => {
      req.headers.authorization = 'Bearer ';

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Malformed authorization header',
      });
      expect(next).not.toHaveBeenCalled();
      expect(verifyJwt).not.toHaveBeenCalled();
    });

    it('returns 401 when Authorization is only "Bearer" without space', async () => {
      req.headers.authorization = 'Bearer';

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No authorization token provided',
      });
    });

    it('returns 401 when token after split is empty string', async () => {
      req.headers.authorization = 'Bearer  '; // Two spaces, split gives empty token

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Malformed authorization header',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // R13.4: Invalid/expired JWT → 401
  // ---------------------------------------------------------------------------
  describe('Invalid or expired JWT', () => {
    it('returns 401 when verifyJwt throws error for invalid token', async () => {
      req.headers.authorization = 'Bearer invalid-token';

      verifyJwt.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await authMiddleware(req, res, next);

      expect(verifyJwt).toHaveBeenCalledWith('invalid-token');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired token. Please sign in again.',
      });
      expect(next).not.toHaveBeenCalled();
      expect(User.findOne).not.toHaveBeenCalled();
    });

    it('returns 401 when JWT is expired', async () => {
      req.headers.authorization = 'Bearer expired-token';

      const expiredError = new Error('jwt expired');
      expiredError.name = 'TokenExpiredError';
      verifyJwt.mockImplementation(() => {
        throw expiredError;
      });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired token. Please sign in again.',
      });
    });

    it('returns 401 for malformed JWT', async () => {
      req.headers.authorization = 'Bearer malformed.jwt';

      verifyJwt.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired token. Please sign in again.',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // R13.5: Valid JWT but user not found or inactive → 401
  // ---------------------------------------------------------------------------
  describe('Valid JWT but user not found or inactive', () => {
    it('returns 401 when user is not found in database', async () => {
      req.headers.authorization = 'Bearer valid-token-no-user';

      const mockPayload = { userId: 'nonexistent-user', email: 'ghost@example.com' };

      verifyJwt.mockReturnValue(mockPayload);
      get.mockResolvedValue(null);
      User.findOne.mockResolvedValue(null); // User not found

      await authMiddleware(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({
        _id: 'nonexistent-user',
        isActive: true,
        deletedAt: null,
      });
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User account no longer exists or is inactive',
      });
      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeFalsy(); // Can be null or undefined
    });

    it('returns 401 when user is inactive (isActive: false)', async () => {
      req.headers.authorization = 'Bearer valid-token-inactive-user';

      const mockPayload = { userId: 'inactive-user', email: 'inactive@example.com' };

      verifyJwt.mockReturnValue(mockPayload);
      get.mockResolvedValue(null);
      User.findOne.mockResolvedValue(null); // Query filters out inactive users

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User account no longer exists or is inactive',
      });
    });

    it('returns 401 when user is soft-deleted (deletedAt is not null)', async () => {
      req.headers.authorization = 'Bearer valid-token-deleted-user';

      const mockPayload = { userId: 'deleted-user', email: 'deleted@example.com' };

      verifyJwt.mockReturnValue(mockPayload);
      get.mockResolvedValue(null);
      User.findOne.mockResolvedValue(null); // Query filters out deleted users

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User account no longer exists or is inactive',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // R13.6: Valid X-Api-Key header → authenticate via API key path
  // ---------------------------------------------------------------------------
  describe('API Key authentication', () => {
    it('attaches req.user and req.apiKeyPermissions for valid active API key', async () => {
      req.headers['x-api-key'] = 'raw-api-key-123';

      const mockKeyRecord = {
        keyHash: 'hashed-key',
        userId: 'api-user-123',
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000), // Future date
        permissions: ['shipments:read', 'shipments:create'],
        lastUsedAt: null,
        save: jest.fn().mockResolvedValue(undefined),
      };

      const mockUser = {
        _id: { toString: () => 'api-user-123' },
        email: 'apiuser@example.com',
        role: 'MERCHANT',
        isActive: true,
        deletedAt: null,
      };

      mockApiKeyModel.findOne.mockResolvedValue(mockKeyRecord);
      User.findOne.mockResolvedValue(mockUser);

      await authMiddleware(req, res, next);

      expect(mockApiKeyModel.findOne).toHaveBeenCalledWith({
        keyHash: expect.any(String),
        isActive: true,
      });
      expect(User.findOne).toHaveBeenCalledWith({
        _id: 'api-user-123',
        isActive: true,
        deletedAt: null,
      });
      expect(req.user).toEqual({
        userId: 'api-user-123',
        email: 'apiuser@example.com',
        role: 'MERCHANT',
      });
      expect(req.apiKeyPermissions).toEqual(['shipments:read', 'shipments:create']);
      expect(mockKeyRecord.save).toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('updates lastUsedAt timestamp when API key is used', async () => {
      req.headers['x-api-key'] = 'track-usage-key';

      const mockKeyRecord = {
        userId: 'user-track',
        isActive: true,
        expiresAt: null, // No expiry
        permissions: [],
        lastUsedAt: null,
        save: jest.fn().mockResolvedValue(undefined),
      };

      const mockUser = {
        _id: { toString: () => 'user-track' },
        email: 'track@example.com',
        role: 'DISTRIBUTOR',
        isActive: true,
        deletedAt: null,
      };

      mockApiKeyModel.findOne.mockResolvedValue(mockKeyRecord);
      User.findOne.mockResolvedValue(mockUser);

      await authMiddleware(req, res, next);

      expect(mockKeyRecord.lastUsedAt).toBeInstanceOf(Date);
      expect(mockKeyRecord.save).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // R13.7: Expired/inactive API key → 401
  // ---------------------------------------------------------------------------
  describe('Invalid or expired API key', () => {
    it('returns 401 when API key is not found', async () => {
      req.headers['x-api-key'] = 'nonexistent-key';

      mockApiKeyModel.findOne.mockResolvedValue(null);

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired API Key',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when API key is inactive', async () => {
      req.headers['x-api-key'] = 'inactive-api-key';

      mockApiKeyModel.findOne.mockResolvedValue(null); // Query filters out inactive keys

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired API Key',
      });
    });

    it('returns 401 when API key is expired', async () => {
      req.headers['x-api-key'] = 'expired-api-key';

      const expiredKeyRecord = {
        userId: 'user-expired',
        isActive: true,
        expiresAt: new Date(Date.now() - 86400000), // Past date
        permissions: [],
      };

      mockApiKeyModel.findOne.mockResolvedValue(expiredKeyRecord);

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired API Key',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when user associated with API key is not found', async () => {
      req.headers['x-api-key'] = 'orphan-key';

      const mockKeyRecord = {
        userId: 'deleted-user-123',
        isActive: true,
        expiresAt: null,
        permissions: [],
        save: jest.fn(),
      };

      mockApiKeyModel.findOne.mockResolvedValue(mockKeyRecord);
      User.findOne.mockResolvedValue(null); // User doesn't exist

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User account associated with API Key no longer exists or is inactive',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when API key authentication throws an error', async () => {
      req.headers['x-api-key'] = 'error-key';

      mockApiKeyModel.findOne.mockRejectedValue(new Error('Database error'));

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error processing API Key authentication',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// requireRole Middleware Tests
// =============================================================================
describe('requireRole middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockReq();
    res = mockRes();
    next = jest.fn();
  });

  // ---------------------------------------------------------------------------
  // R13.8: requireRole with matching roles → call next()
  // ---------------------------------------------------------------------------
  describe('Matching role', () => {
    it('calls next() when user role matches single required role', () => {
      req.user = { userId: 'user-123', email: 'user@example.com', role: 'MERCHANT' };

      const middleware = requireRole('MERCHANT');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() when user role matches one of multiple required roles', () => {
      req.user = { userId: 'admin-456', email: 'admin@example.com', role: 'SUPER_ADMIN' };

      const middleware = requireRole('SUPER_ADMIN', 'DISTRIBUTOR');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() when DISTRIBUTOR role matches in a list', () => {
      req.user = { userId: 'dist-789', email: 'dist@example.com', role: 'DISTRIBUTOR' };

      const middleware = requireRole('MERCHANT', 'DISTRIBUTOR', 'WAREHOUSE');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // R13.9: requireRole with non-matching role → 403
  // ---------------------------------------------------------------------------
  describe('Non-matching role', () => {
    it('returns 403 when user role does not match required role', () => {
      req.user = { userId: 'user-123', email: 'user@example.com', role: 'MERCHANT' };

      const middleware = requireRole('SUPER_ADMIN');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied. Required role: SUPER_ADMIN',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when user role does not match any of multiple required roles', () => {
      req.user = { userId: 'warehouse-123', email: 'warehouse@example.com', role: 'WAREHOUSE' };

      const middleware = requireRole('SUPER_ADMIN', 'DISTRIBUTOR');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied. Required role: SUPER_ADMIN or DISTRIBUTOR',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('includes all required roles in error message when multiple roles specified', () => {
      req.user = { userId: 'user-456', email: 'user@example.com', role: 'MERCHANT' };

      const middleware = requireRole('SUPER_ADMIN', 'DISTRIBUTOR', 'WAREHOUSE');
      middleware(req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.message).toContain('SUPER_ADMIN or DISTRIBUTOR or WAREHOUSE');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe('Edge cases', () => {
    it('returns 401 when req.user is not set', () => {
      req.user = null;

      const middleware = requireRole('MERCHANT');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when req.user is undefined', () => {
      req.user = undefined;

      const middleware = requireRole('SUPER_ADMIN');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized',
      });
    });
  });
});

// =============================================================================
// requirePermission Middleware Tests
// =============================================================================
describe('requirePermission middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockReq();
    res = mockRes();
    next = jest.fn();
  });

  // ---------------------------------------------------------------------------
  // R13.10: requirePermission with sufficient permissions → call next()
  // ---------------------------------------------------------------------------
  describe('Sufficient permissions', () => {
    it('calls next() when apiKeyPermissions contains single required permission', () => {
      req.apiKeyPermissions = ['shipments:read', 'shipments:create', 'disputes:read'];

      const middleware = requirePermission('shipments:read');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() when apiKeyPermissions contains all required permissions', () => {
      req.apiKeyPermissions = ['shipments:read', 'shipments:create', 'shipments:update', 'disputes:read'];

      const middleware = requirePermission('shipments:read', 'shipments:create');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() when apiKeyPermissions exactly matches required permissions', () => {
      req.apiKeyPermissions = ['users:read', 'users:update'];

      const middleware = requirePermission('users:read', 'users:update');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('calls next() when apiKeyPermissions is a superset of required permissions', () => {
      req.apiKeyPermissions = ['admin:*', 'shipments:read', 'shipments:write', 'disputes:manage'];

      const middleware = requirePermission('shipments:read');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // R13.11: requirePermission with insufficient permissions → 403
  // ---------------------------------------------------------------------------
  describe('Insufficient permissions', () => {
    it('returns 403 when apiKeyPermissions does not contain required permission', () => {
      req.apiKeyPermissions = ['shipments:read'];

      const middleware = requirePermission('shipments:write');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'API Key has insufficient permissions. Required: shipments:write',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when apiKeyPermissions is missing one of multiple required permissions', () => {
      req.apiKeyPermissions = ['shipments:read', 'disputes:read'];

      const middleware = requirePermission('shipments:read', 'shipments:create', 'disputes:read');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'API Key has insufficient permissions. Required: shipments:read, shipments:create, disputes:read',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when apiKeyPermissions is empty array', () => {
      req.apiKeyPermissions = [];

      const middleware = requirePermission('admin:access');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'API Key has insufficient permissions. Required: admin:access',
      });
    });

    it('includes all required permissions in error message', () => {
      req.apiKeyPermissions = ['basic:read'];

      const middleware = requirePermission('admin:read', 'admin:write', 'admin:delete');
      middleware(req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.message).toContain('admin:read, admin:write, admin:delete');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe('Edge cases', () => {
    it('calls next() when req.apiKeyPermissions is not set (JWT authentication path)', () => {
      req.apiKeyPermissions = undefined;

      const middleware = requirePermission('any:permission');
      middleware(req, res, next);

      // When apiKeyPermissions is not set, middleware should pass through
      // This happens with JWT-based auth (not API key auth)
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() when req.apiKeyPermissions is null', () => {
      req.apiKeyPermissions = null;

      const middleware = requirePermission('admin:access');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() when no permissions are required', () => {
      req.apiKeyPermissions = ['shipments:read'];

      const middleware = requirePermission(); // No arguments
      middleware(req, res, next);

      // When no permissions are required, .every() on empty array returns true
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
