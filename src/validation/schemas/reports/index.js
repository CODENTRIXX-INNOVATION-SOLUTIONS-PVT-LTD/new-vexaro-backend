'use strict';

const { z } = require('zod/v4');
const { objectIdSchema } = require('../common/base.schemas');
const { validateDateRange } = require('../../validators/date.validator');

const reportQueryDto = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  merchantId: objectIdSchema.optional(),
  distributorId: objectIdSchema.optional(),
  userId: objectIdSchema.optional(),
}).superRefine(validateRange);

const exportQueryDto = reportQueryDto.safeExtend({ warehouseId: objectIdSchema.optional() });

function validateRange(value, ctx) {
  if ((value.dateFrom && !value.dateTo) || (!value.dateFrom && value.dateTo)) {
    ctx.addIssue({ code: 'custom', path: ['dateTo'], message: 'Both dateFrom and dateTo are required for a date range' });
    return;
  }
  if (value.dateFrom && value.dateTo) {
    const result = validateDateRange(value.dateFrom, value.dateTo, { requireTimezone: false, maxRangeDays: 366 });
    if (!result.isValid) ctx.addIssue({ code: 'custom', path: ['dateTo'], message: result.message });
  }
}

const createExportJobSchema = z.object({
  type: z.enum(['SHIPMENTS', 'REVENUE']),
  format: z.enum(['CSV', 'XLSX', 'PDF']),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  merchantId: objectIdSchema.optional(),
  distributorId: objectIdSchema.optional(),
  warehouseId: objectIdSchema.optional(),
  userId: objectIdSchema.optional(),
}).superRefine(validateRange);

const exportJobParamsSchema = z.object({
  jobId: z.string().trim().regex(/^EXP-[a-f\d\-]+$/i, 'Invalid Job ID format'),
});

const downloadParamsSchema = z.object({
  filename: z.string().trim().regex(/^EXP-[a-f\d\-]+\.(csv|xlsx|pdf)$/i, 'Invalid filename format'),
});

module.exports = {
  reportQueryDto,
  exportQueryDto,
  createExportJobSchema,
  exportJobParamsSchema,
  downloadParamsSchema,
};
