'use strict';

const { z } = require('zod/v4');
const { objectIdSchema } = require('./base.schemas');
const { validateDateRange } = require('../../validators/date.validator');

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().trim().max(50).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const dateRangeSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.dateFrom && value.dateTo) {
    const result = validateDateRange(value.dateFrom, value.dateTo, { requireTimezone: false, maxRangeDays: 366 });
    if (!result.isValid) ctx.addIssue({ code: 'custom', path: ['dateTo'], message: result.message });
  }
});

const idFilterSchema = z.object({
  userId: objectIdSchema.optional(),
  merchantId: objectIdSchema.optional(),
  distributorId: objectIdSchema.optional(),
  warehouseId: objectIdSchema.optional(),
});

module.exports = { paginationSchema, dateRangeSchema, idFilterSchema };
