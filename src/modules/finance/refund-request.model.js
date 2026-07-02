'use strict';

const mongoose = require('mongoose');

/**
 * Possible statuses for a merchant's refund request.
 */
const RefundRequestStatus = Object.freeze({
  PENDING:  'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

const refundRequestSchema = new mongoose.Schema(
  {
    merchantId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    distributorId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
      index:   true,
    },
    shipmentId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Shipment',
      required: true,
      index:    true,
    },
    awb: {
      type:     String,
      required: true,
      trim:     true,
    },
    amount: {
      type:     Number,
      required: true,
      min:      [0.01, 'Amount must be positive'],
    },
    reason: {
      type:     String,
      required: true,
      trim:     true,
      maxlength: [1000, 'Reason cannot exceed 1000 characters'],
    },
    status: {
      type:     String,
      enum:     Object.values(RefundRequestStatus),
      default:  RefundRequestStatus.PENDING,
      index:    true,
    },
    reviewedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },
    reviewedAt: {
      type:    Date,
      default: null,
    },
    reviewNote: {
      type:    String,
      default: null,
      trim:    true,
      maxlength: [1000, 'Review note cannot exceed 1000 characters'],
    },
    // Link to the wallet Transaction created on approval
    transactionId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Transaction',
      default: null,
    },
    // Soft delete — reserved for compliance; refund requests are never hard-deleted
    deletedAt: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: false,
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Compound indexes
refundRequestSchema.index({ merchantId: 1, status: 1 });
refundRequestSchema.index({ distributorId: 1, status: 1 });
refundRequestSchema.index({ shipmentId: 1, status: 1 });
refundRequestSchema.index({ status: 1, createdAt: -1 });

const RefundRequest = mongoose.model('RefundRequest', refundRequestSchema);

module.exports = { RefundRequest, RefundRequestStatus };
