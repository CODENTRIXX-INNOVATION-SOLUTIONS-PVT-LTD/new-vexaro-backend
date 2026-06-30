'use strict';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

const DATE_ERROR_CODES = Object.freeze({
  REQUIRED: 'DATE_REQUIRED',
  INVALID_TYPE: 'DATE_INVALID_TYPE',
  INVALID_FORMAT: 'DATE_INVALID_FORMAT',
  INVALID_VALUE: 'DATE_INVALID_VALUE',
  BEFORE_MIN: 'DATE_BEFORE_MIN',
  AFTER_MAX: 'DATE_AFTER_MAX',
  PAST_NOT_ALLOWED: 'DATE_PAST_NOT_ALLOWED',
  FUTURE_NOT_ALLOWED: 'DATE_FUTURE_NOT_ALLOWED',
  NON_WORKING_DAY: 'DATE_NON_WORKING_DAY',
});

function parseDate(value, options = {}) {
  const { allowDateOnly = true, requireTimezone = true } = options;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (allowDateOnly && DATE_ONLY.test(input)) {
    const parsed = new Date(`${input}T00:00:00.000Z`);
    return parsed.toISOString().startsWith(input) ? parsed : null;
  }
  if (requireTimezone && !ISO_DATETIME.test(input)) return null;
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validateDate(value, options = {}) {
  const {
    required = true,
    min,
    max,
    allowPast = true,
    allowFuture = true,
    workingDaysOnly = false,
    now = new Date(),
  } = options;

  if (value === undefined || value === null || value === '') {
    return required ? fail(DATE_ERROR_CODES.REQUIRED, 'Date is required') : { isValid: true, normalized: null };
  }
  if (!(value instanceof Date) && typeof value !== 'string') {
    return fail(DATE_ERROR_CODES.INVALID_TYPE, 'Date must be an ISO string or Date object');
  }
  const date = parseDate(value, options);
  if (!date) return fail(DATE_ERROR_CODES.INVALID_FORMAT, 'Date must be a valid ISO 8601 value with timezone');

  const minDate = min === undefined ? null : parseDate(min, { allowDateOnly: true, requireTimezone: false });
  const maxDate = max === undefined ? null : parseDate(max, { allowDateOnly: true, requireTimezone: false });
  if (minDate && date < minDate) return fail(DATE_ERROR_CODES.BEFORE_MIN, 'Date is before the allowed range');
  if (maxDate && date > maxDate) return fail(DATE_ERROR_CODES.AFTER_MAX, 'Date is after the allowed range');
  if (!allowPast && date < now) return fail(DATE_ERROR_CODES.PAST_NOT_ALLOWED, 'Past dates are not allowed');
  if (!allowFuture && date > now) return fail(DATE_ERROR_CODES.FUTURE_NOT_ALLOWED, 'Future dates are not allowed');
  if (workingDaysOnly && [0, 6].includes(date.getUTCDay())) {
    return fail(DATE_ERROR_CODES.NON_WORKING_DAY, 'Date must be a working day');
  }

  return { isValid: true, date, normalized: date.toISOString() };
}

function validateDateRange(start, end, options = {}) {
  const startResult = validateDate(start, options);
  if (!startResult.isValid) return { ...startResult, field: 'start' };
  const endResult = validateDate(end, options);
  if (!endResult.isValid) return { ...endResult, field: 'end' };
  if (startResult.date > endResult.date) {
    return fail(DATE_ERROR_CODES.INVALID_VALUE, 'Start date must be before or equal to end date');
  }
  const maxRangeDays = options.maxRangeDays;
  if (maxRangeDays && endResult.date - startResult.date > maxRangeDays * 86400000) {
    return fail(DATE_ERROR_CODES.INVALID_VALUE, `Date range must not exceed ${maxRangeDays} days`);
  }
  return { isValid: true, start: startResult.normalized, end: endResult.normalized };
}

function fail(error, message) { return { isValid: false, error, message }; }
function isValidDate(value, options) { return validateDate(value, options).isValid; }

function createDateSchema(options = {}) {
  const { z } = require('zod/v4');
  return z.union([z.string(), z.date()]).transform((value, ctx) => {
    const result = validateDate(value, options);
    if (!result.isValid) {
      ctx.addIssue({ code: 'custom', message: result.message });
      return z.NEVER;
    }
    return result.normalized;
  });
}

module.exports = {
  DATE_ERROR_CODES,
  DATE_ONLY,
  ISO_DATETIME,
  parseDate,
  validateDate,
  validateDateRange,
  isValidDate,
  createDateSchema,
};
