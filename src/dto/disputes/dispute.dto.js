const { z } = require('zod/v4');
const { DisputeCategory, DisputeStatus } = require('../../constants');
const { mongoIdSchema } = require('../../utils/validation');

const mongoId = mongoIdSchema;

const createDisputeSchema = z.object({
  shipmentId:  mongoId,
  category:    z.enum(Object.values(DisputeCategory), { error: `Category must be one of: ${Object.values(DisputeCategory).join(', ')}` }),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000).trim(),
});

const updateDisputeSchema = z.object({
  status:     z.enum(Object.values(DisputeStatus)).optional(),
  assignedTo: mongoId.optional(),
  resolution: z.string().trim().max(2000).optional(),
  comment:    z.string().trim().max(1000).optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field required' });

const listQuerySchema = z.object({
  page:       z.string().optional().transform(v => v ? parseInt(v) : 1).pipe(z.number().int().min(1)),
  limit:      z.string().optional().transform(v => v ? parseInt(v) : 20).pipe(z.number().int().min(1).max(100)),
  status:     z.enum(Object.values(DisputeStatus)).optional(),
  category:   z.enum(Object.values(DisputeCategory)).optional(),
  shipmentId: mongoId.optional(),
});

const proofImageUrlSchema = z.string().trim().refine(
  value => {
    try {
      new URL(value);
      return true;
    } catch {
      return value.startsWith('/uploads/');
    }
  },
  'Proof image must be a valid URL or uploaded file path',
);

const raiseWeightDisputeSchema = z.object({
  shipmentId:   mongoId,
  actualWeight: z.number().positive('Actual weight must be positive'),
  extraCharge:  z.number().min(0, 'Extra charge cannot be negative'),
  proofImages:  z.array(proofImageUrlSchema).optional(),
});

const resolveWeightDisputeSchema = z.object({
  status: z.enum([DisputeStatus.RESOLVED, DisputeStatus.CLOSED]),
});

const submitDisputeProofSchema = z.object({
  proofImages: z.array(proofImageUrlSchema).min(1, 'At least one proof image is required'),
});

const listWeightDisputesQuerySchema = z.object({
  page:       z.string().optional().transform(v => v ? parseInt(v) : 1).pipe(z.number().int().min(1)),
  limit:      z.string().optional().transform(v => v ? parseInt(v) : 20).pipe(z.number().int().min(1).max(100)),
  status:     z.enum([DisputeStatus.OPEN, DisputeStatus.RESOLVED, DisputeStatus.CLOSED]).optional(),
  shipmentId: mongoId.optional(),
});

module.exports = {
  createDisputeSchema,
  updateDisputeSchema,
  listQuerySchema,
  raiseWeightDisputeSchema,
  resolveWeightDisputeSchema,
  submitDisputeProofSchema,
  listWeightDisputesQuerySchema,
};
