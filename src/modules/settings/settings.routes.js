'use strict';

const { Router } = require('express');
const { authMiddleware } = require('../../middleware/auth.middleware');
const settingsController = require('./settings.controller');
const { validateRequest } = require('../../validation');
const schemas = require('../../validation/schemas/settings');
const { emptyObjectSchema } = require('../../validation/schemas/common/base.schemas');

const router = Router();
router.use(authMiddleware);

// GET /api/settings/profile
router.get('/profile', validateRequest({ query: emptyObjectSchema }), settingsController.getProfile);

// PATCH /api/settings/profile
router.patch('/profile', validateRequest({ body: schemas.updateProfileDto }), settingsController.updateProfile);

// POST /api/settings/change-password
router.post('/change-password', validateRequest({ body: schemas.changePasswordDto }), settingsController.changePassword);

// GET /api/settings/api-keys
router.get('/api-keys', validateRequest({ query: emptyObjectSchema }), settingsController.getApiKeys);

// POST /api/settings/api-keys
router.post('/api-keys', validateRequest({ body: schemas.createApiKeyDto }), settingsController.createApiKey);

// DELETE /api/settings/api-keys/:id — revoke a key
router.delete('/api-keys/:id', validateRequest({ params: schemas.apiKeyIdParamsSchema }), settingsController.revokeApiKey);

// GET /api/settings/notifications — view notification preferences
router.get('/notifications', validateRequest({ query: emptyObjectSchema }), settingsController.getNotificationPrefs);

// PATCH /api/settings/notifications — update notification preferences
router.patch('/notifications', validateRequest({ body: schemas.updateNotificationPrefsDto }), settingsController.updateNotificationPrefs);

module.exports = router;
