'use strict';

const mongoose = require('mongoose');

const addressSubSchema = new mongoose.Schema(
  {
    addressLine: { type: String, required: true, trim: true },
    city:        { type: String, required: true, trim: true },
    state:       { type: String, required: true, trim: true },
    pincode:     { type: String, required: true, trim: true },
    country:     { type: String, required: true, trim: true, default: 'India' },
  },
  { _id: false },
);

const warehouseChangeRequestSchema = new mongoose.Schema(
  {
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    distributorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    currentAddress: {
      type: addressSubSchema,
      required: true,
    },
    requestedAddress: {
      type: addressSubSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Compound indexes as required
warehouseChangeRequestSchema.index({ warehouseId: 1, status: 1 });
warehouseChangeRequestSchema.index({ merchantId: 1, status: 1 });
warehouseChangeRequestSchema.index({ distributorId: 1, status: 1 });

const WarehouseChangeRequest = mongoose.model(
  'WarehouseChangeRequest',
  warehouseChangeRequestSchema,
);

module.exports = { WarehouseChangeRequest };
