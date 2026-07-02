'use strict';

const settingsService = require('./settings.service');
const { success, created } = require('../../utils/response');

/**
 * Settings Controller
 * Handles HTTP requests for settings.
 */

const getProfile = async (req, res) => {
  const profile = await settingsService.getProfileService(req.user.userId);
  success(res, 'Profile retrieved', profile);
};

const updateProfile = async (req, res) => {
  // Safe validation data is extracted from req.validated.body if it exists
  const dto = req.validated.body;
  const profile = await settingsService.updateProfileService(req.user.userId, dto);
  success(res, 'Profile updated', profile);
};

const changePassword = async (req, res) => {
  const dto = req.validated.body;
  const result = await settingsService.changePasswordService(req.user.userId, dto);
  success(res, result.message);
};

const getApiKeys = async (req, res) => {
  const keys = await settingsService.getApiKeysService(req.user.userId);
  success(res, 'API keys retrieved', keys);
};

const createApiKey = async (req, res) => {
  const dto = req.validated.body;
  const result = await settingsService.createApiKeyService(req.user.userId, dto);
  created(res, 'API key created. Save the key now — it will not be shown again.', result);
};

const revokeApiKey = async (req, res) => {
  const result = await settingsService.revokeApiKeyService(req.user.userId, req.params.id);
  success(res, result.message);
};

const getNotificationPrefs = async (req, res) => {
  const prefs = await settingsService.getNotificationPrefsService(req.user.userId);
  success(res, 'Notification preferences retrieved', prefs);
};

const updateNotificationPrefs = async (req, res) => {
  const dto = req.validated.body;
  const prefs = await settingsService.updateNotificationPrefsService(req.user.userId, dto);
  success(res, 'Notification preferences updated successfully', prefs);
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getApiKeys,
  createApiKey,
  revokeApiKey,
  getNotificationPrefs,
  updateNotificationPrefs,
};
