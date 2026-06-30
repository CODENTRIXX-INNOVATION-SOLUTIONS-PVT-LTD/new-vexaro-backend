/**
 * src/modules/rates/rate-card.model.js
 *
 * RateCard — created by Super Admin, defines per-weight-slab shipping prices.
 * Extracted from rate.routes.js so it can be imported cleanly by:
 *  - shipment.service.js  (rate lookup during booking)
 *  - rate.routes.js       (CRUD)
 *  - scripts/create-indexes.js (index creation without loading the router)
 */

'use strict';

const mongoose = require('mongoose');
const { ShipmentServiceType } = require('../../constants');

const rateCardSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: true,
      trim:     true,
      unique:   true,
    },
    description: {
      type:    String,
      default: null,
    },
    serviceType: {
      type:     String,
      enum:     Object.values(ShipmentServiceType),
      required: true,
    },
    // Weight slabs: [ { upToKg, ratePerKg, baseRate } ]
    // Sorted ascending by upToKg — first slab whose upToKg >= shipment weight wins.
    weightSlabs: [
      {
        upToKg:    { type: Number, required: true },  // inclusive upper bound in kg
        ratePerKg: { type: Number, required: true },  // ₹ per kg
        baseRate:  { type: Number, default: 0 },      // flat base charge for this slab
      },
    ],
    codCharge:   { type: Number, default: 0 },   // flat ₹ added on COD shipments
    codPercent:  { type: Number, default: 0 },   // % of COD amount added on COD shipments
    fuelSurcharge: { type: Number, default: 0 }, // % added to final rate

    // % markup SA adds on top of carrier cost when pricing to distributors
    superAdminMarkupPercent: { type: Number, default: 25 },

    isActive: { type: Boolean, default: true },

    // Restrict card to specific distributors; empty array = globally visible
    applicableTo: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ],
  },
  { timestamps: true },
);

rateCardSchema.index({ serviceType: 1, isActive: 1 });

const RateCard = mongoose.model('RateCard', rateCardSchema);

module.exports = { RateCard };
