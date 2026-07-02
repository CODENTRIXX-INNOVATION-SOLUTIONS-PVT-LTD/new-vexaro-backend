const { z } = require('zod/v4');

/**
 * Standard Zod schema to validate Mongoose ObjectIds
 */
const mongoIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

module.exports = {
  mongoIdSchema,
};
