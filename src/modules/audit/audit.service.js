'use strict';

const mongoose = require('mongoose');
const { AuditLog } = require('./audit-log.model');

/**
 * Logs a business audit event fire-and-forget style.
 *
 * userId can be:
 *  - A real MongoDB ObjectId / ObjectId string  → stored as-is
 *  - null / undefined                            → stored as null (system events)
 *  - The string "SYSTEM"                         → normalised to null
 */
const logAuditEvent = (userId, action, metadata = {}, targetId = null) => {
  // Normalise userId — only store it if it's a valid ObjectId
  let safeUserId = null;
  if (userId && userId !== 'SYSTEM') {
    const id = userId?.toString?.() ?? String(userId);
    if (mongoose.Types.ObjectId.isValid(id)) {
      safeUserId = id;
    }
  }

  const safeTargetId = targetId ? String(targetId) : null;

  // Fire-and-forget — never blocks the calling request
  setImmediate(async () => {
    try {
      await AuditLog.create({
        userId:   safeUserId,
        action,
        metadata,
        targetId: safeTargetId,
      });
    } catch (err) {
      console.error('[AuditLog] Failed to write audit event:', err.message);
    }
  });
};

module.exports = { logAuditEvent };
