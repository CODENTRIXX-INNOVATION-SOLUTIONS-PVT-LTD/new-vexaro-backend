'use strict';

const mongoose = require('mongoose');

/**
 * RechargeRequest — Distributor manually requests SA to top-up their wallet.
 * SA approves → TOPUP transaction is created.
 * SA rejects  → request is marked REJECTED, no transaction.
 */
const rechargeRequestSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    amount: {
      type:     Number,
      required: true,
      min:      [1, 'Amount must be positive'],
    },
    paymentMethod: {
      type:    String,
      enum:    ['UPI', 'NEFT', 'IMPS', 'RTGS', 'Cash', 'Cheque'],
      default: 'UPI',
    },
    referenceId: {
      type:    String,
      default: null,
      trim:    true,
    },
    status: {
      type:    String,
      enum:    ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index:   true,
    },
    rejectionReason: {
      type:    String,
      default: null,
    },
    // Set when SA approves — links to the resulting wallet transaction
    transactionId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Transaction',
      default: null,
    },
    processedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },
    processedAt: {
      type:    Date,
      default: null,
    },
  },
  { timestamps: true },
);

rechargeRequestSchema.index({ userId: 1, createdAt: -1 });
rechargeRequestSchema.index({ status: 1, createdAt: -1 });

const RechargeRequest = mongoose.model('RechargeRequest', rechargeRequestSchema);

module.exports = { RechargeRequest };
