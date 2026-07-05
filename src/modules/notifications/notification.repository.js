'use strict';

const { Notification } = require('./notification.model');

/**
 * Notification Repository
 * Pure data-access layer — no business logic, no try/catch.
 */

/** Find one notification by _id and userId. */
const findByIdAndUser = (id, userId) =>
  Notification.findOne({ _id: id, userId });

/** Paginated list of notifications for a user. Returns [notifications[], total, unreadCount]. */
const findPaginated = async (filter, { skip, limit, sort = { isRead: 1, createdAt: -1 } } = {}) => {
  return Promise.all([
    Notification.find(filter).sort(sort).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId: filter.userId, isRead: false }),
  ]);
};

/** Count unread notifications for a user. */
const countUnread = (userId) =>
  Notification.countDocuments({ userId, isRead: false });

/** Create a new notification. */
const create = (data) =>
  Notification.create(data);

/** Mark a single notification as read. */
const markAsRead = (id, userId) =>
  Notification.findOneAndUpdate({ _id: id, userId }, { isRead: true }, { returnDocument: 'after' });

/** Mark all notifications for a user as read. */
const markAllAsRead = (userId) =>
  Notification.updateMany({ userId, isRead: false }, { isRead: true });

/** Delete a notification by _id and userId. */
const deleteByIdAndUser = (id, userId) =>
  Notification.findOneAndDelete({ _id: id, userId });

module.exports = {
  findByIdAndUser,
  findPaginated,
  countUnread,
  create,
  markAsRead,
  markAllAsRead,
  deleteByIdAndUser,
};
