'use strict';

const { z } = require('zod');

/**
 * Super Admin Report Validation Schemas
 * Placeholder schemas for future validation logic
 * 
 * TODO: Implement specific validation schemas for each endpoint
 */

// Placeholder query schema for date range filters
const dateRangeQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  period: z.enum(['today', 'week', 'month', 'quarter', 'year']).optional(),
});

// Placeholder pagination schema
const paginationQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
});

// Placeholder ID filter schema
const idFilterSchema = z.object({
  merchantId: z.string().optional(),
  distributorId: z.string().optional(),
  warehouseId: z.string().optional(),
});

// Placeholder export schema
const exportSchema = z.object({
  reportType: z.enum(['shipments', 'revenue', 'merchants', 'distributors', 'cod']).optional(),
  format: z.enum(['csv', 'xlsx', 'pdf']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

module.exports = {
  dateRangeQuerySchema,
  paginationQuerySchema,
  idFilterSchema,
  exportSchema,
};
