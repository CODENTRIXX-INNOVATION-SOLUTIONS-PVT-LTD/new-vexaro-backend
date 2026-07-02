'use strict';

const mongoose = require('mongoose');

const idempotencySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    responseStatus: {
      type: Number,
      default: null,
    },
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    inFlight: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // TTL index: auto delete after 24 hours (86400 seconds)
    },
  },
  { timestamps: true },
);

const Idempotency = mongoose.model('Idempotency', idempotencySchema);

module.exports = { Idempotency };
