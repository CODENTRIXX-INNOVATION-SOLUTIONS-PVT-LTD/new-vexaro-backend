const { z } = require('zod/v4');
const { TransactionType } = require('../../modules/finance/finance.model');
const { mongoIdSchema } = require('../../utils/validation');

const mongoId = mongoIdSchema;

const topupSchema = z.object({
  userId: mongoId,
  amount: z.number({ error: 'Amount must be a number' }).positive('Amount must be greater than 0'),
  note:   z.string().trim().optional(),
});

const remitCODSchema = z.object({
  note: z.string().trim().optional(),
});

const createSettlementSchema = z.object({
  toUserId:  mongoId,
  amount:    z.number().positive('Amount must be greater than 0'),
  reference: z.string().trim().optional(),
  note:      z.string().trim().optional(),
});

const processSettlementSchema = z.object({
  success: z.boolean({ error: 'success (true/false) is required' }),
  note:    z.string().trim().optional(),
});

const listQuerySchema = z.object({
  page:      z.string().optional().transform(v => v ? parseInt(v) : 1).pipe(z.number().int().min(1)),
  limit:     z.string().optional().transform(v => v ? parseInt(v) : 20).pipe(z.number().int().min(1).max(100)),
  userId:    mongoId.optional(),
  type:      z.enum(Object.values(TransactionType)).optional(),
  scope:     z.enum(['MERCHANT']).optional(),
  status:    z.string().trim().optional(),
  merchantId:mongoId.optional(),
  dateFrom:  z.string().optional(),
  dateTo:    z.string().optional(),
  directOnly:z.string().optional().transform(v => v === 'true' || v === '1').optional(),
});

const transferToMerchantSchema = z.object({
  merchantId: mongoId,
  amount:     z.number({ error: 'Amount must be a number' }).positive('Amount must be greater than 0'),
  note:       z.string().trim().optional(),
});

const refundSchema = z.object({
  userId:     mongoId,
  amount:     z.number({ error: 'Amount must be a number' }).positive('Amount must be greater than 0'),
  note:       z.string().trim().optional(),
  shipmentId: mongoId.optional(),
});

module.exports = {
  topupSchema,
  remitCODSchema,
  createSettlementSchema,
  processSettlementSchema,
  listQuerySchema,
  transferToMerchantSchema,
  refundSchema,
};
