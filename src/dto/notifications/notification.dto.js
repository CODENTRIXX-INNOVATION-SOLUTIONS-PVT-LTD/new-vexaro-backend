const { z } = require('zod/v4');
const { mongoIdSchema } = require('../../utils/validation');

const listNotificationsQuerySchema = z.object({
  page:   z.string().optional().transform(v => v ? parseInt(v, 10) : 1).pipe(z.number().int().min(1)),
  limit:  z.string().optional().transform(v => v ? parseInt(v, 10) : 20).pipe(z.number().int().min(1).max(100)),
  unread: z.enum(['true', 'false']).optional(),
});

const markReadSchema = z.object({
  ids: z.array(mongoIdSchema).optional(),
});

const raiseQuerySchema = z.object({
  subject: z.string().trim().min(3).max(100),
  message: z.string().trim().min(10).max(1000),
  orderId: z.union([mongoIdSchema, z.literal(""), z.literal(null)]).optional().nullable(),
});

module.exports = {
  listNotificationsQuerySchema,
  markReadSchema,
  raiseQuerySchema,
};
