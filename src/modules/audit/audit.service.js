// 'use strict';

// const { AuditLog } = require('./audit-log.model');

// /**
//  * Logs a business audit event asynchronously
//  */
// const logAuditEvent = (userId, action, metadata = {}, targetId = null) => {
//   const userIdStr = userId?.toString?.() || String(userId);
//   const targetIdStr = targetId?.toString?.() || (targetId ? String(targetId) : null);

//   setImmediate(async () => {
//     try {
//       await AuditLog.create({
//         userId: userIdStr,
//         action,
//         metadata,
//         targetId: targetIdStr,
//       });
//     } catch (err) {
//       console.error('[AuditLog] Failed to write audit event:', err.message);
//     }
//   });
// };

// module.exports = {
//   logAuditEvent,
// };




'use strict';

const { AuditLog } = require('./audit-log.model');

const logAuditEvent = async (
  userId,
  action,
  metadata = {},
  targetId = null
) => {
  try {
    await AuditLog.create({
      userId,
      action,
      metadata,
      targetId,
    });
  } catch (err) {
    console.error('[AuditLog] Failed to write audit event:', err.message);
  }
};

module.exports = {
  logAuditEvent,
};