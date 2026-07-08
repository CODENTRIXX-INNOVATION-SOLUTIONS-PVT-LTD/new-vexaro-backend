'use strict';

const notificationService = require('./notification.service');
const { success, created } = require('../../utils/response');

/**
 * Notification Controller
 * Handles HTTP requests for notifications.
 */

const getNotifications = async (req, res) => {
  const query = req.validated.query;
  const result = await notificationService.listNotificationsService(req.user.userId, query);
  success(res, 'Notifications retrieved', result);
};

const markAllAsRead = async (req, res) => {
  const result = await notificationService.markAllAsReadService(req.user.userId);
  success(res, result.message);
};

const markAsRead = async (req, res) => {
  const notif = await notificationService.markAsReadService(req.params.id, req.user.userId);
  success(res, 'Notification marked as read', notif);
};

const deleteNotification = async (req, res) => {
  const result = await notificationService.deleteNotificationService(req.params.id, req.user.userId);
  success(res, result.message);
};

const raiseQuery = async (req, res) => {
  const notif = await notificationService.raiseQueryService(req.user, req.validated.body);
  created(res, 'Query alert raised successfully', notif);
};

module.exports = {
  getNotifications,
  markAllAsRead,
  markAsRead,
  deleteNotification,
  raiseQuery,
};
