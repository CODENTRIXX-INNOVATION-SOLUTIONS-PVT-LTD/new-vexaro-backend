const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { UserRole } = require('../constants');

// ─── JWT ───────────────────────────────────────────────────────────────────────

const signJwt = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
};

const verifyJwt = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};

// ─── Secure Random Tokens ──────────────────────────────────────────────────────

/** Generate a URL-safe random token (hex string) */
const generateToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/** Returns a future Date offset by `hours` from now */
const tokenExpiry = (hours) => {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
};


// ─── Role → Dashboard Path ─────────────────────────────────────────────────────

const roleToDashboardPath = (role) => {
  const paths = {
    [UserRole.SUPER_ADMIN]: '/super-admin',
    [UserRole.DISTRIBUTOR]: '/distributor',
    [UserRole.MERCHANT]:    '/merchant',
    [UserRole.WAREHOUSE]:   '/warehouse',
  };
  return paths[role] ?? '/login';
};

const { success, created, paginated } = require('./response');
const { runInTransaction, checkTransactionSupport } = require('./transaction');

module.exports = {
  signJwt,
  verifyJwt,
  generateToken,
  hashToken,
  tokenExpiry,
  roleToDashboardPath,
  runInTransaction,
  checkTransactionSupport,
  success,
  created,
  paginated,
};
