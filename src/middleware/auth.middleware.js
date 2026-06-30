const { verifyJwt } = require('../utils');
const { User } = require('../modules/users/user.model');
const { get, set, TTL, KEYS } = require('../utils/cache');

const sendError = (res, message, statusCode = 401) => {
  return res.status(statusCode).json({ success: false, message });
};

// ─── authMiddleware ────────────────────────────────────────────────────────────
// Verifies the Bearer JWT, confirms the user is still active,
// and attaches { userId, email, role } to req.user.
const authMiddleware = async (req, res, next) => {
  const apiKeyHeader = req.headers['x-api-key'];

  if (apiKeyHeader) {
    const crypto = require('crypto');
    const mongoose = require('mongoose');
    const ApiKey = mongoose.model('ApiKey');

    const keyHash = crypto.createHash('sha256').update(apiKeyHeader).digest('hex');
    try {
      const keyRecord = await ApiKey.findOne({ keyHash, isActive: true });
      if (!keyRecord || (keyRecord.expiresAt && keyRecord.expiresAt < new Date())) {
        return sendError(res, 'Invalid or expired API Key', 401);
      }

      const user = await User.findOne({
        _id: keyRecord.userId,
        isActive: true,
        deletedAt: null,
      });

      if (!user) {
        return sendError(res, 'User account associated with API Key no longer exists or is inactive', 401);
      }

      keyRecord.lastUsedAt = new Date();
      await keyRecord.save();

      req.user = {
        userId: user._id.toString(),
        email:  user.email,
        role:   user.role,
      };
      req.apiKeyPermissions = keyRecord.permissions || [];

      return next();
    } catch (err) {
      return sendError(res, 'Error processing API Key authentication', 401);
    }
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'No authorization token provided', 401);
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return sendError(res, 'Malformed authorization header', 401);
  }

  try {
    const payload = verifyJwt(token);

    // ── Cache-aside: user profile ─────────────────────────────────────────────
    // Auth runs on every request — caching saves a DB round-trip each time.
    const cacheKey = KEYS.userProfile(payload.userId);
    let userData   = await get(cacheKey);

    if (!userData) {
      const user = await User.findOne({
        _id:       payload.userId,
        isActive:  true,
        deletedAt: null,
      });

      if (!user) {
        return sendError(res, 'User account no longer exists or is inactive', 401);
      }

      userData = {
        userId: user._id.toString(),
        email:  user.email,
        role:   user.role,
      };
      await set(cacheKey, userData, TTL.USER_PROFILE);
    }

    req.user = userData;
    next();
  } catch {
    return sendError(res, 'Invalid or expired token. Please sign in again.', 401);
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }
    if (!roles.includes(req.user.role)) {
      return sendError(
        res,
        `Access denied. Required role: ${roles.join(' or ')}`,
        403
      );
    }
    next();
  };
};

const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    // If request is authenticated via API Key, verify permissions
    if (req.apiKeyPermissions) {
      const hasPermission = requiredPermissions.every(p => req.apiKeyPermissions.includes(p));
      if (!hasPermission) {
        return sendError(
          res,
          `API Key has insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
          403
        );
      }
    }
    next();
  };
};

module.exports = { authMiddleware, requireRole, requirePermission };
