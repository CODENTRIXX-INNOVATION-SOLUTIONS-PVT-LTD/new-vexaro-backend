'use strict';

const buildNotificationPayload = (userId, payload) => {
  const userIdStr = userId?.toString?.() || String(userId);
  const type = payload.type || 'SYSTEM';

  return {
    userId: userIdStr,
    title: payload.title,
    message: payload.message,
    type,
    isRead: false,
    createdAt: new Date(),
  };
};

module.exports = {
  buildNotificationPayload,
};
