const mongoose = require('mongoose');
const { NotificationType } = require('../../constants');

const notificationSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title:    { type: String, required: true, trim: true },
    message:  { type: String, required: true, trim: true },
    type:     { type: String, enum: Object.values(NotificationType), default: NotificationType.SYSTEM },
    isRead:   { type: Boolean, default: false, index: true },
    link:     { type: String, default: null },   // frontend deep-link
    meta:     { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = { Notification };
