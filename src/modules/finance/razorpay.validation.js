const { z } = require('zod/v4');
const { env } = require('../../config/env');

const { mongoIdSchema } = require('../../utils/validation');
const mongoId = mongoIdSchema;

// ─── POST /api/finance/razorpay/create-order ──────────────────────────────────
const createOrderSchema = z.object({
  // Amount in INR (whole rupees — we convert to paise for Razorpay)
  amount: z
    .number({ error: 'Amount must be a number' })
    .int('Amount must be a whole number in rupees')
    .min(100, 'Minimum topup amount is ₹100')
    .max(env.RAZORPAY_MAX_TOPUP_AMOUNT, `Maximum topup amount is ₹${env.RAZORPAY_MAX_TOPUP_AMOUNT}`),
});

// ─── POST /api/finance/razorpay/verify-payment ────────────────────────────────
const verifyPaymentSchema = z.object({
  // Internal Payment document _id (returned from create-order)
  paymentId: mongoId,
  // razorpay_order_id from checkout response
  orderId: z
    .string({ error: 'orderId is required' })
    .trim()
    .min(1, 'orderId cannot be empty'),
  // razorpay_signature from checkout response
  signature: z
    .string({ error: 'signature is required' })
    .trim()
    .min(1, 'signature cannot be empty'),
  // razorpay_payment_id from checkout response
  razorpayPaymentId: z
    .string({ error: 'razorpayPaymentId is required' })
    .trim()
    .min(1, 'razorpayPaymentId cannot be empty'),
});

// ─── GET /api/finance/payments ────────────────────────────────────────────────
const paymentListQuerySchema = z.object({
  page:   z.string().optional().transform(v => (v ? parseInt(v) : 1)).pipe(z.number().int().min(1)),
  limit:  z.string().optional().transform(v => (v ? parseInt(v) : 20)).pipe(z.number().int().min(1).max(100)),
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED']).optional(),
  // Filter by date range (ISO strings)
  dateFrom:  z.string().optional(),
  dateTo:    z.string().optional(),
  // Filter by exact amount (whole rupees)
  amount:    z.string().optional().transform(v => (v ? parseFloat(v) : undefined)),
  // SA/Distributor can filter by userId
  userId:    mongoId.optional(),
});

module.exports = { createOrderSchema, verifyPaymentSchema, paymentListQuerySchema };
