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

module.exports = { listNotificationsQuerySchema, markReadSchema };
