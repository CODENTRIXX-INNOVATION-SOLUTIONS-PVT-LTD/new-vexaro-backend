'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const settingsRepository = require('./settings.repository');

/**
 * Settings Service
 * Contains all business logic for profile updates, credentials, API key management and preferences.
 */

const getProfileService = async (userId) => {
  const user = await settingsRepository.findUserById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return user.getPublicProfile();
};

const updateProfileService = async (userId, dto) => {
  const user = await settingsRepository.findUserById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  
  Object.assign(user, dto);
  await settingsRepository.saveUser(user);
  return user.getPublicProfile();
};

const changePasswordService = async (userId, dto) => {
  const user = await settingsRepository.findUserByIdWithPassword(userId);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const valid = await user.comparePassword(dto.currentPassword);
  if (!valid) throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 });

  user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
  await settingsRepository.saveUser(user);
  return { message: 'Password changed successfully' };
};

const getApiKeysService = async (userId) => {
  return settingsRepository.findApiKeysByUser(userId);
};

const createApiKeyService = async (userId, dto) => {
  const rawKey = `vx_${crypto.randomBytes(32).toString('hex')}`;   // vx_<64 hex chars>
  const keyHash    = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPreview = `••••••••${rawKey.slice(-4)}`;

  const apiKey = await settingsRepository.createApiKey({
    userId,
    name:        dto.name,
    keyHash,
    keyPreview,
    permissions: dto.permissions,
    expiresAt:   dto.expiresAt || null,
  });

  // Return raw key ONCE alongside saved details
  return {
    id:          apiKey._id,
    name:        apiKey.name,
    key:         rawKey,          // ← one-time reveal
    permissions: apiKey.permissions,
    expiresAt:   apiKey.expiresAt,
    createdAt:   apiKey.createdAt,
  };
};

const revokeApiKeyService = async (userId, keyId) => {
  const key = await settingsRepository.findApiKeyByIdAndUser(keyId, userId);
  if (!key) throw Object.assign(new Error('API key not found'), { statusCode: 404 });

  key.isActive = false;
  await settingsRepository.saveApiKey(key);
  return { message: 'API key revoked' };
};

const getNotificationPrefsService = async (userId) => {
  const user = await settingsRepository.findUserById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return user.notificationPreferences || {};
};

const updateNotificationPrefsService = async (userId, dto) => {
  const user = await settingsRepository.findUserById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  user.notificationPreferences = {
    ...user.notificationPreferences,
    ...dto,
  };
  await settingsRepository.saveUser(user);
  return user.notificationPreferences;
};

module.exports = {
  getProfileService,
  updateProfileService,
  changePasswordService,
  getApiKeysService,
  createApiKeyService,
  revokeApiKeyService,
  getNotificationPrefsService,
  updateNotificationPrefsService,
};
