'use strict';

const { Router } = require('express');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { wrapController } = require('../../utils/errors');
const notificationController = require('./notification.controller');
const { validateRequest } = require('../../validation');
const schemas = require('../../validation/schemas/notifications');
const { emptyObjectSchema } = require('../../validation/schemas/common/base.schemas');

const router = Router();
router.use(authMiddleware);

const wrap = wrapController;

// GET /api/notifications  — own notifications, unread first
router.get('/', validateRequest({ query: schemas.listNotificationsQuerySchema }), wrap(notificationController.getNotifications));

// PATCH /api/notifications/mark-read — mark all as read
router.patch('/mark-read', validateRequest({ body: schemas.markReadSchema }), wrap(notificationController.markAllAsRead));

// PATCH /api/notifications/:id/read — mark single as read
router.patch('/:id/read', validateRequest({ params: schemas.notificationIdParamsSchema, body: emptyObjectSchema }), wrap(notificationController.markAsRead));

// DELETE /api/notifications/:id — delete notification
router.delete('/:id', validateRequest({ params: schemas.notificationIdParamsSchema }), wrap(notificationController.deleteNotification));

module.exports = router;
