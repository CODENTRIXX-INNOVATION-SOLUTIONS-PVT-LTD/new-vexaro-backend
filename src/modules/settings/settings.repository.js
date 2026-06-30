'use strict';

const { User } = require('../users/user.model');
const { ApiKey } = require('./api-key.model');

/**
 * Settings Repository
 * Pure data-access layer — no business logic, no try/catch.
 */

// ─── User / Profile ───────────────────────────────────────────────────────────

/** Find an active, non-deleted user by _id. */
const findUserById = (id) =>
  User.findOne({ _id: id, deletedAt: null });

/** Find an active, non-deleted user by _id, including passwordHash. */
const findUserByIdWithPassword = (id) =>
  User.findOne({ _id: id, deletedAt: null }).select('+passwordHash');

/** Save a user document. */
const saveUser = (user, options = {}) => user.save(options);

// ─── API Keys ─────────────────────────────────────────────────────────────────

/** Find all active API keys for a user. */
const findApiKeysByUser = (userId) =>
  ApiKey.find({ userId, isActive: true }).sort({ createdAt: -1 });

/** Find a single API key by _id and userId. */
const findApiKeyByIdAndUser = (id, userId) =>
  ApiKey.findOne({ _id: id, userId });

/** Create a new API key document. */
const createApiKey = (data) => ApiKey.create(data);

/** Save an API key document. */
const saveApiKey = (apiKey, options = {}) => apiKey.save(options);

module.exports = {
  findUserById,
  findUserByIdWithPassword,
  saveUser,
  findApiKeysByUser,
  findApiKeyByIdAndUser,
  createApiKey,
  saveApiKey,
};
