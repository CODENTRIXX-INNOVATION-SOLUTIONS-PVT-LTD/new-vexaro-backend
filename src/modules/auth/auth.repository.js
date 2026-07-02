'use strict';

const { User } = require('../users/user.model');
const { RefreshToken } = require('./refresh-token.model');

/**
 * Auth Repository
 * Pure data-access layer — no business logic, no try/catch, no service calls.
 * All functions return Mongoose documents or null.
 */

/** Find an active (non-deleted) user by email, selecting passwordHash. */
const findUserByEmail = (email) =>
  User.findOne({ email: email.toLowerCase().trim(), deletedAt: null }).select('+passwordHash');

/** Find an active (non-deleted) user by MongoDB _id. */
const findUserById = (id) =>
  User.findOne({ _id: id, deletedAt: null });

/** Find an active user by _id (no deletedAt filter — used internally). */
const findActiveUserById = (id) =>
  User.findOne({ _id: id, isActive: true, deletedAt: null });

/** Create a new refresh token document. */
const createRefreshToken = ({ userId, tokenHash, expiresAt }) =>
  RefreshToken.create({ userId, tokenHash, expiresAt });

/** Find a refresh token by its SHA-256 hash. */
const findRefreshTokenByHash = (tokenHash) =>
  RefreshToken.findOne({ tokenHash });

/** Revoke (mark isRevoked = true) a specific refresh token by its _id. */
const revokeRefreshToken = (id) =>
  RefreshToken.findByIdAndUpdate(id, { isRevoked: true });

/** Revoke a specific token by hash (used during logout). */
const revokeRefreshTokenByHash = (tokenHash) =>
  RefreshToken.findOneAndUpdate({ tokenHash, isRevoked: false }, { isRevoked: true });

/** Revoke ALL active refresh tokens for a given userId (e.g. on deactivation). */
const revokeAllRefreshTokensByUserId = (userId) =>
  RefreshToken.updateMany({ userId, isRevoked: false }, { isRevoked: true });

/** Update a user's lastLoginAt timestamp. */
const updateLastLogin = (userId) =>
  User.findByIdAndUpdate(userId, { lastLoginAt: new Date() });

/** Persist reset token fields on a user document. */
const setResetToken = (userId, resetTokenHash, resetTokenExpiry) =>
  User.findByIdAndUpdate(userId, { resetTokenHash, resetTokenExpiry });

/** Find a user by their reset token hash (selects hidden fields). */
const findUserByResetTokenHash = (resetTokenHash) =>
  User.findOne({ resetTokenHash }).select('+resetTokenHash +resetTokenExpiry');

/** Find a user by their invite token hash (selects hidden fields). */
const findUserByInviteTokenHash = (inviteTokenHash) =>
  User.findOne({ inviteTokenHash }).select('+inviteTokenHash +inviteTokenExpiry');

/** Find an active user by _id, selecting passwordHash (for auth operations). */
const findUserByIdWithPassword = (id) =>
  User.findOne({ _id: id, deletedAt: null }).select('+passwordHash');

/** Save a user document (calls .save() which triggers pre-save hooks). */
const saveUser = (user) => user.save();

module.exports = {
  findUserByEmail,
  findUserById,
  findActiveUserById,
  createRefreshToken,
  findRefreshTokenByHash,
  revokeRefreshToken,
  revokeRefreshTokenByHash,
  revokeAllRefreshTokensByUserId,
  updateLastLogin,
  setResetToken,
  findUserByResetTokenHash,
  findUserByInviteTokenHash,
  findUserByIdWithPassword,
  saveUser,
};
