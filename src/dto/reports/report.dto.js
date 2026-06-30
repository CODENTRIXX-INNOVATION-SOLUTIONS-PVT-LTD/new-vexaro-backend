const { z } = require('zod/v4');
const { mongoIdSchema } = require('../../utils/validation');

const reportQueryDto = z.object({
  dateFrom:      z.string().optional(),
  dateTo:        z.string().optional(),
  merchantId:    mongoIdSchema.optional(),
  distributorId: mongoIdSchema.optional(),
  userId:        mongoIdSchema.optional(),
});

const exportQueryDto = z.object({
  dateFrom:      z.string().optional(),
  dateTo:        z.string().optional(),
  merchantId:    mongoIdSchema.optional(),
  distributorId: mongoIdSchema.optional(),
  warehouseId:   mongoIdSchema.optional(),
  userId:        mongoIdSchema.optional(),
});

module.exports = { reportQueryDto, exportQueryDto };
