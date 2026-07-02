'use strict';

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789',
  'qwerty123', 'admin123', 'letmein', 'welcome', 'welcome123',
  'iloveyou', 'monkey123', 'india123', 'vexaro123',
]);

const PASSWORD_ERROR_CODES = Object.freeze({
  REQUIRED: 'PASSWORD_REQUIRED',
  INVALID_TYPE: 'PASSWORD_INVALID_TYPE',
  TOO_SHORT: 'PASSWORD_TOO_SHORT',
  TOO_LONG: 'PASSWORD_TOO_LONG',
  MISSING_UPPERCASE: 'PASSWORD_MISSING_UPPERCASE',
  MISSING_LOWERCASE: 'PASSWORD_MISSING_LOWERCASE',
  MISSING_NUMBER: 'PASSWORD_MISSING_NUMBER',
  MISSING_SYMBOL: 'PASSWORD_MISSING_SYMBOL',
  COMMON: 'PASSWORD_COMMON',
  CONTAINS_CONTEXT: 'PASSWORD_CONTAINS_PERSONAL_DATA',
  REPEATED: 'PASSWORD_REPEATED_PATTERN',
  WHITESPACE: 'PASSWORD_CONTAINS_WHITESPACE',
});

const MESSAGES = Object.freeze({
  [PASSWORD_ERROR_CODES.REQUIRED]: 'Password is required',
  [PASSWORD_ERROR_CODES.INVALID_TYPE]: 'Password must be a string',
  [PASSWORD_ERROR_CODES.MISSING_UPPERCASE]: 'Password must contain an uppercase letter',
  [PASSWORD_ERROR_CODES.MISSING_LOWERCASE]: 'Password must contain a lowercase letter',
  [PASSWORD_ERROR_CODES.MISSING_NUMBER]: 'Password must contain a number',
  [PASSWORD_ERROR_CODES.MISSING_SYMBOL]: 'Password must contain a symbol',
  [PASSWORD_ERROR_CODES.COMMON]: 'Password is too common',
  [PASSWORD_ERROR_CODES.CONTAINS_CONTEXT]: 'Password must not contain personal information',
  [PASSWORD_ERROR_CODES.REPEATED]: 'Password contains an easily guessed repeated pattern',
  [PASSWORD_ERROR_CODES.WHITESPACE]: 'Password must not contain whitespace',
});

function validatePassword(password, options = {}) {
  const {
    minLength = 12,
    maxLength = 128,
    requireUppercase = true,
    requireLowercase = true,
    requireNumber = true,
    requireSymbol = true,
    blockCommon = true,
    context = [],
  } = options;

  if (password === undefined || password === null || password === '') {
    return failure(PASSWORD_ERROR_CODES.REQUIRED);
  }
  if (typeof password !== 'string') return failure(PASSWORD_ERROR_CODES.INVALID_TYPE);
  if (password.length < minLength) {
    return failure(PASSWORD_ERROR_CODES.TOO_SHORT, `Password must be at least ${minLength} characters`);
  }
  if (password.length > maxLength) {
    return failure(PASSWORD_ERROR_CODES.TOO_LONG, `Password must not exceed ${maxLength} characters`);
  }

  const checks = [
    [requireUppercase && !/[A-Z]/.test(password), PASSWORD_ERROR_CODES.MISSING_UPPERCASE],
    [requireLowercase && !/[a-z]/.test(password), PASSWORD_ERROR_CODES.MISSING_LOWERCASE],
    [requireNumber && !/\d/.test(password), PASSWORD_ERROR_CODES.MISSING_NUMBER],
    [requireSymbol && !/[^A-Za-z0-9\s]/.test(password), PASSWORD_ERROR_CODES.MISSING_SYMBOL],
    [/\s/u.test(password), PASSWORD_ERROR_CODES.WHITESPACE],
    [/(.)\1{3,}/u.test(password), PASSWORD_ERROR_CODES.REPEATED],
  ];
  const failed = checks.find(([condition]) => condition);
  if (failed) return failure(failed[1]);

  const normalized = password.toLowerCase();
  const canonical = normalized.replace(/[^a-z0-9]/g, '');
  if (blockCommon && (COMMON_PASSWORDS.has(normalized) || COMMON_PASSWORDS.has(canonical))) {
    return failure(PASSWORD_ERROR_CODES.COMMON);
  }

  const contextTerms = (Array.isArray(context) ? context : [context])
    .filter((term) => typeof term === 'string')
    .flatMap((term) => term.toLowerCase().split(/[^a-z0-9]+/))
    .filter((term) => term.length >= 3);
  if (contextTerms.some((term) => normalized.includes(term))) {
    return failure(PASSWORD_ERROR_CODES.CONTAINS_CONTEXT);
  }

  const characterClasses = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9\s]/]
    .filter((pattern) => pattern.test(password)).length;
  const score = Math.min(4, Math.floor(password.length / 4) + characterClasses - 2);

  return { isValid: true, score, strength: ['weak', 'weak', 'fair', 'strong', 'very-strong'][score] };
}

function failure(error, message = MESSAGES[error]) {
  return { isValid: false, error, message };
}

function isValidPassword(password, options) {
  return validatePassword(password, options).isValid;
}

function createPasswordSchema(options = {}) {
  const { z } = require('zod/v4');
  return z.string().superRefine((value, ctx) => {
    const result = validatePassword(value, options);
    if (!result.isValid) ctx.addIssue({ code: 'custom', message: result.message });
  });
}

module.exports = {
  COMMON_PASSWORDS,
  PASSWORD_ERROR_CODES,
  validatePassword,
  isValidPassword,
  createPasswordSchema,
};
