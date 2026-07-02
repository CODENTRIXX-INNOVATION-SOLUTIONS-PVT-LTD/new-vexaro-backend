const { z } = require('zod/v4');
const { TicketStatus, TicketPriority, TicketCategory } = require('../../constants');
const { mongoIdSchema } = require('../../utils/validation');

const createTicketDto = z.object({
  subject:     z.string().min(5, 'Subject must be at least 5 characters').max(200).trim(),
  description: z.string().min(20, 'Description must be at least 20 characters').max(3000).trim(),
  category:    z.enum(Object.values(TicketCategory)),
  priority:    z.enum(Object.values(TicketPriority)).optional(),
  shipmentRef: mongoIdSchema.optional(),
  attachments: z.array(z.string()).optional(),
});

const updateTicketDto = z.object({
  status:     z.enum(Object.values(TicketStatus)).optional(),
  assignedTo: mongoIdSchema.optional(),
  priority:   z.enum(Object.values(TicketPriority)).optional(),
}).refine(d => Object.keys(d).filter(k => d[k] !== undefined).length > 0, { message: 'At least one field required' });

const addReplyDto = z.object({
  message:     z.string().min(1, 'Reply message is required').max(2000).trim(),
  attachments: z.array(z.string()).optional(),
});

const listTicketsQueryDto = z.object({
  page:     z.string().optional().transform(v => v ? parseInt(v, 10) : 1).pipe(z.number().int().min(1)),
  limit:    z.string().optional().transform(v => v ? parseInt(v, 10) : 20).pipe(z.number().int().min(1).max(100)),
  status:   z.enum(Object.values(TicketStatus)).optional(),
  priority: z.enum(Object.values(TicketPriority)).optional(),
  category: z.enum(Object.values(TicketCategory)).optional(),
});

module.exports = { createTicketDto, updateTicketDto, addReplyDto, listTicketsQueryDto };
