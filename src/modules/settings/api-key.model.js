/**
 * src/modules/settings/api-key.model.js
 *
 * ApiKey — generated per-user for programmatic API access.
 * Extracted from settings.routes.js so it can be imported cleanly by:
 *  - auth.middleware.js  (validates X-API-Key header on every request)
 *  - settings.routes.js  (CRUD: create, list, revoke)
 *
 * Security design:
 *  - The raw key is shown ONCE on creation and never stored.
 *  - Only the SHA-256 hash (keyHash) is persisted.
 *  - keyPreview stores the last 4 chars for display (e.g. "••••••••abcd").
 */

'use strict';

const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    name: {
      type:     String,
      required: true,
      trim:     true,
    },
    // SHA-256 hash of the raw key — never store the raw value
    keyHash: {
      type:     String,
      required: true,
      select:   false,   // never included in query results by default
    },
    // Last 4 chars prefixed with bullets for display: "••••••••abcd"
    keyPreview: {
      type: String,
    },
    permissions: [
      {
        type: String,
        enum: ['READ', 'WRITE', 'WEBHOOK', 'ADMIN'],
      },
    ],
    lastUsedAt: { type: Date, default: null },
    expiresAt:  { type: Date, default: null },
    isActive:   { type: Boolean, default: true },
  },
  { timestamps: true },
);

apiKeySchema.index({ keyHash: 1 }, { unique: true });
apiKeySchema.index({ userId: 1 });

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

module.exports = { ApiKey };
