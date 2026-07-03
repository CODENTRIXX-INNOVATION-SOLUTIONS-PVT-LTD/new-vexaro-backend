'use strict';

const { z } = require('zod/v4');
const legacy = require('../../../dto/finance/finance.dto');
const razorpay = require('../../../modules/finance/razorpay.validation');
const { moneySchema, objectIdSchema } = require('../common/base.schemas');

const amount = moneySchema({ min: 0.01, max: 10000000 });
const topupSchema = legacy.topupSchema.extend({ amount });
const refundSchema = legacy.refundSchema.extend({ amount });
const transferToMerchantSchema = legacy.transferToMerchantSchema.extend({ amount });
const createSettlementSchema = legacy.createSettlementSchema.extend({ amount });
const financeIdParamsSchema = z.object({ id: objectIdSchema });

const submitRefundRequestSchema = z.object({
  shipmentId: objectIdSchema,
  amount: moneySchema({ min: 0.01, max: 10000000 }),
  reason: z.string().trim().min(5).max(1000),
});

const processRefundRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().trim().max(1000).optional(),
}).refine(data => {
  if (data.status === 'REJECTED' && (!data.reviewNote || data.reviewNote.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: 'A review note is required when rejecting a refund request.',
  path: ['reviewNote']
});

const refundRequestIdParamsSchema = z.object({
  id: objectIdSchema,
});

const rechargeWalletSchema = z.object({
  distributorId: objectIdSchema,
  amount: moneySchema({ min: 1, max: 10000000 }),
  paymentMethod: z.enum(['UPI', 'NEFT', 'IMPS', 'RTGS', 'Cash', 'Cheque']),
  referenceId: z.string().trim().max(100).optional(),
});

const rejectRechargeRequestSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

const createRechargeRequestSchema = z.object({
  amount: moneySchema({ min: 1, max: 10000000 }),
  paymentMethod: z.enum(['UPI', 'NEFT', 'IMPS', 'RTGS', 'Cash', 'Cheque']),
  referenceId: z.string().trim().max(100).optional(),
});

const refundPaymentSchema = z.object({
  amount: moneySchema({ min: 0.01, max: 10000000 }).optional(),
  reason: z.string().trim().min(5).max(500),
});

module.exports = {
  ...legacy,
  ...razorpay,
  topupSchema,
  refundSchema,
  transferToMerchantSchema,
  createSettlementSchema,
  financeIdParamsSchema,
  submitRefundRequestSchema,
  processRefundRequestSchema,
  refundRequestIdParamsSchema,
  rechargeWalletSchema,
  rejectRechargeRequestSchema,
  createRechargeRequestSchema,
  refundPaymentSchema,
};
