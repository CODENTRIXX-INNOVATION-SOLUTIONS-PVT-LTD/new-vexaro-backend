'use strict';

const notificationRepository = require('./notification.repository');
const userRepository = require('../users/user.repository');
const { UserRole } = require('../../constants');
const { getPaginationParams, buildPaginationMeta } = require('../../utils/pagination');
const { buildNotificationPayload } = require('./notification.factory');
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

const raiseQueryService = async (callerUser, payload) => {
  const { subject, message, orderId } = payload;
  const callerId = callerUser.userId;

  const callerProfile = await userRepository.findById(callerId);
  if (!callerProfile) {
    throw Object.assign(new Error('User profile not found'), { statusCode: 404 });
  }

  if (callerProfile.role === UserRole.MERCHANT) {
    if (!callerProfile.invitedBy) {
      throw Object.assign(new Error('Merchant has no assigned Distributor to receive this query'), { statusCode: 400 });
    }

    const distributorId = callerProfile.invitedBy.toString();
    const title = 'New Merchant Query Raised';
    const queryMessage = `[${subject}] ${message}`;
    const link = orderId ? `/distributor/shipments/${orderId}?showQuery=true` : '/distributor/support';

    const built = buildNotificationPayload(distributorId, {
      senderId: callerId,
      title,
      message: queryMessage,
      type: 'QUERY',
      priority: 'WARNING',
      link,
      meta: orderId ? { orderId } : null,
    });

    const notif = await notificationRepository.create(built);
    return notif;

  } else if (callerProfile.role === UserRole.DISTRIBUTOR) {
    const admins = await userRepository.findAll({ role: UserRole.SUPER_ADMIN, isActive: true, deletedAt: null }, '_id');
    if (!admins || admins.length === 0) {
      throw Object.assign(new Error('No active Super Admins found to receive this query'), { statusCode: 404 });
    }

    const title = 'New Distributor Query Raised';
    const queryMessage = `[${subject}] ${message}`;
    const link = orderId ? `/admin/queries?orderId=${orderId}` : '/super-admin/dashboard';

    const notificationsToCreate = admins.map(admin => {
      return buildNotificationPayload(admin._id, {
        senderId: callerId,
        title,
        message: queryMessage,
        type: 'QUERY',
        priority: 'WARNING',
        link,
        meta: orderId ? { orderId } : null,
      });
    });

    const createdNotifs = await notificationRepository.create(notificationsToCreate);
    return Array.isArray(createdNotifs) ? createdNotifs[0] : createdNotifs;

  } else {
    throw Object.assign(new Error('Only Merchants and Distributors are authorized to raise query alerts'), { statusCode: 403 });
  }
};

module.exports = {
  createNotification,
  listNotificationsService,
  markAllAsReadService,
  markAsReadService,
  deleteNotificationService,
  raiseQueryService,
};
