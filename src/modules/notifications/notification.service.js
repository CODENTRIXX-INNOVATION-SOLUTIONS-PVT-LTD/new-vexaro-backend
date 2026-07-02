'use strict';

const notificationRepository = require('./notification.repository');
const { getPaginationParams, buildPaginationMeta } = require('../../utils/pagination');
const { createNotification } = require('./notification.provider');

const listNotificationsService = async (userId, query) => {
  const { page, limit, skip } = getPaginationParams(query, 20);
  const filter = { userId };
  if (query.unread === 'true') filter.isRead = false;

  const [notifications, total, unreadCount] = await notificationRepository.findPaginated(filter, { skip, limit });
  const meta = buildPaginationMeta(total, page, limit);

  return {
    notifications,
    unreadCount,
    ...meta,
  };
};

const markAllAsReadService = async (userId) => {
  await notificationRepository.markAllAsRead(userId);
  return { message: 'All notifications marked as read' };
};

const markAsReadService = async (id, userId) => {
  const notif = await notificationRepository.markAsRead(id, userId);
  if (!notif) throw Object.assign(new Error('Notification not found'), { statusCode: 404 });
  return notif;
};

const deleteNotificationService = async (id, userId) => {
  const notif = await notificationRepository.deleteByIdAndUser(id, userId);
  if (!notif) throw Object.assign(new Error('Notification not found'), { statusCode: 404 });
  return { message: 'Notification deleted' };
};

module.exports = {
  createNotification,
  listNotificationsService,
  markAllAsReadService,
  markAsReadService,
  deleteNotificationService,
};
