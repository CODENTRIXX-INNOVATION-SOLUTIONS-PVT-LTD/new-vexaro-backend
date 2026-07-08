'use strict';

const buildNotificationPayload = (userId, payload) => {
  const userIdStr = userId?.toString?.() || String(userId);
  const type = payload.type || 'SYSTEM';
  const priority = payload.priority || 'INFO';
  const senderId = payload.senderId || null;
  const link = payload.link || null;
  const meta = payload.meta || null;

  return {
    userId: userIdStr,
    senderId,
    title: payload.title,
    message: payload.message,
    type,
    priority,
    isRead: false,
    link,
    meta,
    createdAt: new Date(),
  };
};

module.exports = {
  buildNotificationPayload,
};
