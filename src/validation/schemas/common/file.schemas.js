'use strict';

const { z } = require('zod/v4');

const uploadedFileSchema = z.object({
  originalname: z.string().min(1).max(255),
  mimetype: z.string().min(1).max(150),
  size: z.number().int().positive().max(5 * 1024 * 1024),
  buffer: z.instanceof(Buffer).optional(),
  path: z.string().optional(),
});

const csvFileSchema = uploadedFileSchema.refine(
  (file) => file.mimetype === 'text/csv' && file.originalname.toLowerCase().endsWith('.csv'),
  'A CSV file is required',
);

module.exports = { uploadedFileSchema, csvFileSchema };
