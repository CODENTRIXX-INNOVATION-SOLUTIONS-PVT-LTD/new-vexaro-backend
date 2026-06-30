const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    // SHA-256 hash of the raw token — never store the raw token
    tokenHash: {
      type:     String,
      required: true,
    },
    expiresAt: {
      type:     Date,
      required: true,
    },
    isRevoked: {
      type:    Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// Unique sparse index on tokenHash for fast look-ups
refreshTokenSchema.index({ tokenHash: 1 }, { unique: true, sparse: true });
// Index on userId to quickly revoke all tokens for a user
refreshTokenSchema.index({ userId: 1 });
// TTL index so MongoDB auto-cleans expired tokens after 1 day grace period
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = { RefreshToken };
