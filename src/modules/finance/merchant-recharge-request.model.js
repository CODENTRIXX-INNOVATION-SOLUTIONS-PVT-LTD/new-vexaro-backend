'use strict';

const mongoose = require('mongoose');

/**
 * MerchantRechargeRequest — Merchant requests their distributor to top-up their wallet.
 * Distributor approves → funds are transferred from distributor wallet → merchant wallet.
 * Distributor rejects → request is marked REJECTED, no transaction.
 */
const merchantRechargeRequestSchema = new mongoose.Schema(
  {
    // Merchant who raised the request
    merchantId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    // Distributor who should approve it (merchant's invitedBy)
    distributorId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      default:  null,
      index:    true,
    },
    amount: {
      type:     Number,
      required: true,
      min:      [1, 'Amount must be positive'],
    },
    note: {
      type:    String,
      default: null,
      trim:    true,
      maxlength: 500,
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
    // Set when distributor approves — links to the resulting wallet transaction
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

merchantRechargeRequestSchema.index({ merchantId: 1, createdAt: -1 });
merchantRechargeRequestSchema.index({ distributorId: 1, status: 1, createdAt: -1 });

const MerchantRechargeRequest = mongoose.model('MerchantRechargeRequest', merchantRechargeRequestSchema);

module.exports = { MerchantRechargeRequest };
