'use strict';

const { Router } = require('express');
const { authMiddleware, requireRole } = require('../../middleware/auth.middleware');
const { UserRole } = require('../../constants');
const platformSettingsController = require('./platform-settings.controller');

const router = Router();
router.use(authMiddleware);

// GET /api/platform-settings - Get platform settings (Super Admin only)
router.get('/', 
  requireRole(UserRole.SUPER_ADMIN),
  platformSettingsController.getPlatformSettings
);

// PATCH /api/platform-settings - Update platform settings (Super Admin only)
router.patch('/', 
  requireRole(UserRole.SUPER_ADMIN),
  platformSettingsController.updatePlatformSettings
);

module.exports = router;
