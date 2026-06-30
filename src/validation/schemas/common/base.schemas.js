'use strict';

const { z } = require('zod/v4');
const { validateEmail } = require('../../validators/email.validator');
const { validatePhone } = require('../../validators/phone.validator');
const { validatePincode } = require('../../validators/pincode.validator');
const { createPasswordSchema } = require('../../validators/password.validator');
const { createDateSchema } = require('../../validators/date.validator');

const objectIdSchema = z.string().trim().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');
const mongoIdSchema = objectIdSchema;
const nonEmptyStringSchema = z.string().trim().min(1).max(1000);
const emailSchema = z.string().trim().toLowerCase().max(254).superRefine((value, ctx) => {
  const result = validateEmail(value);
  if (!result.isValid) ctx.addIssue({ code: 'custom', message: result.message || 'Invalid email address' });
});
const phoneSchema = z.string().trim().transform((value, ctx) => {
  const result = validatePhone(value);
  if (!result.isValid) {
    ctx.addIssue({ code: 'custom', message: result.message || 'Invalid phone number' });
    return z.NEVER;
  }
  return result.normalized;
});
const pincodeSchema = z.string().trim().transform((value, ctx) => {
  const result = validatePincode(value);
  if (!result.isValid) {
    ctx.addIssue({ code: 'custom', message: result.message || 'Invalid PIN code' });
    return z.NEVER;
  }
  return result.normalized;
});
const moneySchema = (options = {}) => {
  const { min = 0, max = 10000000, precision = 2 } = options;
  const factor = 10 ** precision;
  return z.number().finite().min(min).max(max).refine(
    (value) => Math.abs(value * factor - Math.round(value * factor)) < 1e-7,
    `Amount cannot have more than ${precision} decimal places`,
  );
};
const passwordSchema = createPasswordSchema();
const dateTimeSchema = createDateSchema();
const emptyObjectSchema = z.object({});
const idParamsSchema = z.object({ id: objectIdSchema });

module.exports = {
  objectIdSchema,
  mongoIdSchema,
  nonEmptyStringSchema,
  emailSchema,
  phoneSchema,
  pincodeSchema,
  moneySchema,
  passwordSchema,
  dateTimeSchema,
  emptyObjectSchema,
  idParamsSchema,
};
