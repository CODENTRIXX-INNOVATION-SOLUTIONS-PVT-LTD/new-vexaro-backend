'use strict';

const { z } = require('zod/v4');
const { env } = require('../../config/env');
const { mongoIdSchema } = require('../../utils/validation');

const nonEmptyString = (field) =>
  z.string({ error: `${field} is required` }).trim().min(1, `${field} cannot be empty`);

const createOrderSchema = z.object({
  amount: z
    .number({ error: 'Amount must be a number' })
    .positive('Amount must be positive')
    .multipleOf(0.01, 'Amount can have at most two decimal places')
    .min(100, 'Minimum topup amount is INR 100')
    .max(env.RAZORPAY_MAX_TOPUP_AMOUNT, `Maximum topup amount is INR ${env.RAZORPAY_MAX_TOPUP_AMOUNT}`),
  source: z.enum(['checkout', 'upi_qr']).optional(),
});

const verifyPaymentSchema = z.object({
  paymentId: mongoIdSchema.optional(),
  orderId: nonEmptyString('orderId').optional(),
  razorpayOrderId: nonEmptyString('razorpayOrderId').optional(),
  razorpay_order_id: nonEmptyString('razorpay_order_id').optional(),
  razorpayPaymentId: nonEmptyString('razorpayPaymentId').optional(),
  razorpay_payment_id: nonEmptyString('razorpay_payment_id').optional(),
  signature: nonEmptyString('signature').optional(),
  razorpaySignature: nonEmptyString('razorpaySignature').optional(),
  razorpay_signature: nonEmptyString('razorpay_signature').optional(),
}).refine((data) => data.orderId || data.razorpayOrderId || data.razorpay_order_id, {
  message: 'Razorpay order id is required',
}).refine((data) => data.razorpayPaymentId || data.razorpay_payment_id, {
  message: 'Razorpay payment id is required',
}).refine((data) => data.signature || data.razorpaySignature || data.razorpay_signature, {
  message: 'Razorpay signature is required',
});

const paymentListQuerySchema = z.object({
  page: z.string().optional().transform(v => (v ? parseInt(v, 10) : 1)).pipe(z.number().int().min(1)),
  limit: z.string().optional().transform(v => (v ? parseInt(v, 10) : 20)).pipe(z.number().int().min(1).max(100)),
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  amount: z.string().optional().transform(v => (v ? parseFloat(v) : undefined)),
  userId: mongoIdSchema.optional(),
});

module.exports = {
  createOrderSchema,
  verifyPaymentSchema,
  paymentListQuerySchema,
};
