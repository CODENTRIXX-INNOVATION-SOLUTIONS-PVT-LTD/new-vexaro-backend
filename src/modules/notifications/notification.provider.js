'use strict';

const notificationRepository = require('./notification.repository');
const userRepository = require('../users/user.repository');
const { get } = require('../../utils/cache');
const { buildNotificationPayload } = require('./notification.factory');

const createNotification = (userId, payload) => {
  const userIdStr = userId?.toString?.() || String(userId);
  const type = payload.type || 'SYSTEM';

  setImmediate(async () => {
    try {
      const cached = await get(`vx:user:profile:${userIdStr}`);

      if (cached?.notificationPreferences) {
        if (cached.notificationPreferences[type] === false) return; // opted out
      } else {
        const user = await userRepository.findOne({ _id: userIdStr }, 'notificationPreferences');
        if (user?.notificationPreferences?.[type] === false) return; // opted out
      }

      const built = buildNotificationPayload(userIdStr, payload);
      await notificationRepository.create(built);
    } catch (err) {
      console.error('[Notification] Failed to create:', err.message);
    }
  });
};

module.exports = {
  createNotification,
};
