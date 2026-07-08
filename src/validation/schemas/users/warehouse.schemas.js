'use strict';

const { z } = require('zod/v4');
const { objectIdSchema } = require('../common/base.schemas');

const phoneRegex = /^[6-9]\d{9}$/;
const pincodeRegex = /^\d{6}$/;

const updateContactSchema = z
  .object({
    contactPerson: z.string().trim().min(1).max(100).optional(),
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, 'Phone number must be 10 digits starting with 6, 7, 8, or 9')
      .optional(),
    email: z.string().trim().email('Invalid email format').optional(),
    gstNo: z.string().trim().max(20).regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'GST must be in valid format (e.g. 29ABCDE1234F1Z5)').optional().or(z.literal('')),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one contact field must be provided for update',
  });

const addressChangeRequestSchema = z.object({
  addressLine: z.string().trim().min(1, 'Address line is required').max(200),
  city: z.string().trim().min(1, 'City is required').max(50),
  state: z.string().trim().min(1, 'State is required').max(50),
  pincode: z
    .string()
    .trim()
    .regex(pincodeRegex, 'PIN code must be exactly 6 digits'),
  country: z.string().trim().max(50).default('India'),
});

const rejectRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'Rejection reason must be at least 10 characters')
    .max(500, 'Rejection reason cannot exceed 500 characters'),
});

const listRequestsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1)),
  pageSize: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20)),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
});

const warehouseIdParamsSchema = z.object({
  id: objectIdSchema,
});

const requestIdParamsSchema = z.object({
  requestId: objectIdSchema,
});

module.exports = {
  updateContactSchema,
  addressChangeRequestSchema,
  rejectRequestSchema,
  listRequestsQuerySchema,
  warehouseIdParamsSchema,
  requestIdParamsSchema,
};
