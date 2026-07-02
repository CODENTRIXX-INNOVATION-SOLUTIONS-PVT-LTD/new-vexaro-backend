/**
 * src/modules/rates/margin-config.model.js
 *
 * MarginConfig — distributor sets their own markup % on top of an SA rate card.
 * One document per (distributorId, rateCardId) pair — upserted on create.
 * Extracted from rate.routes.js so it can be imported cleanly by:
 *  - shipment.service.js  (margin lookup during booking)
 *  - rate.routes.js       (CRUD)
 *  - scripts/create-indexes.js (index creation)
 */

'use strict';

const mongoose = require('mongoose');

const marginConfigSchema = new mongoose.Schema(
  {
    distributorId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    rateCardId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'RateCard',
      required: true,
    },
    // % markup the distributor charges on top of the SA rate
    marginPercent: {
      type:     Number,
      required: true,
      min:      0,
      max:      100,
    },
    // Flat ₹ amount added per shipment (on top of the % margin)
    flatMargin: { type: Number, default: 0 },
    isActive:   { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Unique constraint: one config per distributor + rate card combination
marginConfigSchema.index({ distributorId: 1, rateCardId: 1 }, { unique: true });

const MarginConfig = mongoose.model('MarginConfig', marginConfigSchema);

module.exports = { MarginConfig };
