'use strict';

const validationMiddleware = require('./middleware/validation.middleware');
const { sanitizeMiddleware } = require('./middleware/sanitize.middleware');
const uploadMiddleware = require('./middleware/upload.middleware');
const authSchemas = require('./schemas/auth');
const userSchemas = require('./schemas/users');
const shipmentSchemas = require('./schemas/shipments');
const financeSchemas = require('./schemas/finance');
const disputeSchemas = require('./schemas/disputes');
const supportSchemas = require('./schemas/support');
const reportSchemas = require('./schemas/reports');
const settingsSchemas = require('./schemas/settings');
const notificationSchemas = require('./schemas/notifications');
const rateSchemas = require('./schemas/rates');
const baseSchemas = require('./schemas/common/base.schemas');
const querySchemas = require('./schemas/common/query.schemas');
const fileSchemas = require('./schemas/common/file.schemas');
const passwordValidator = require('./validators/password.validator');
const dateValidator = require('./validators/date.validator');
const moneyValidator = require('./validators/money.validator');
const phoneValidator = require('./validators/phone.validator');
const emailValidator = require('./validators/email.validator');
const pincodeValidator = require('./validators/pincode.validator');
const objectIdValidator = require('./validators/objectid.validator');
const errorCodes = require('./constants/error-codes');
const limits = require('./constants/limits');
const patterns = require('./constants/patterns');

const DEFAULT_CONFIG = Object.freeze({
  errorFormat: 'detailed',
  includeStackTrace: false,
  enableCaching: false,
  cacheTimeout: 300,
  maxRequestSize: '10mb',
  sanitizeInput: true,
  abortEarly: false,
  stripUnknown: false,
  allowExtraFields: false,
  validationTargets: ['params', 'headers', 'query', 'body', 'files'],
  defaultLocale: 'en',
});

let currentConfig = { ...DEFAULT_CONFIG };

function initializeFramework(config = {}) {
  if (config.errorFormat && !['detailed', 'simple'].includes(config.errorFormat)) {
    throw new TypeError('errorFormat must be "detailed" or "simple"');
  }
  if (config.cacheTimeout !== undefined && (!Number.isFinite(config.cacheTimeout) || config.cacheTimeout <= 0)) {
    throw new TypeError('cacheTimeout must be a positive number');
  }
  currentConfig = { ...DEFAULT_CONFIG, ...config };
  return { ...currentConfig };
}

function getFrameworkConfig() { return { ...currentConfig }; }
function resetFrameworkConfig() { currentConfig = { ...DEFAULT_CONFIG }; return { ...currentConfig }; }

function formatValidationError(error, requestId) {
  const response = {
    success: false,
    requestId: requestId || null,
    timestamp: new Date().toISOString(),
    message: error?.message || 'Validation failed',
    error: 'ValidationError',
  };
  if (currentConfig.errorFormat === 'detailed') {
    response.errors = error?.errors || (error?.issues || []).map((issue) => ({
      field: issue.path?.join('.') || 'request',
      code: issue.code || 'VALIDATION_FAILED',
      message: issue.message,
    }));
  }
  if (currentConfig.includeStackTrace && error?.stack) response.stack = error.stack;
  return response;
}

const schemas = {
  auth: authSchemas,
  users: userSchemas,
  shipments: shipmentSchemas,
  finance: financeSchemas,
  disputes: disputeSchemas,
  support: supportSchemas,
  reports: reportSchemas,
  settings: settingsSchemas,
  notifications: notificationSchemas,
  rates: rateSchemas,
  common: { ...baseSchemas, ...querySchemas, ...fileSchemas },
};

const middleware = {
  ...validationMiddleware,
  sanitizeMiddleware,
  ...uploadMiddleware,
};

const validators = {
  password: passwordValidator,
  date: dateValidator,
  money: moneyValidator,
  phone: phoneValidator,
  email: emailValidator,
  pincode: pincodeValidator,
  objectId: objectIdValidator,
};

const constants = {
  DEFAULT_CONFIG,
  ERROR_CODES: {
    VALIDATION_FAILED: 'VALIDATION_FAILED', INVALID_SCHEMA: 'INVALID_SCHEMA',
    MISSING_FIELD: 'MISSING_FIELD', INVALID_FORMAT: 'INVALID_FORMAT',
  },
  LIMITS: {
    MAX_STRING_LENGTH: 10000, MAX_NUMBER_VALUE: Number.MAX_SAFE_INTEGER,
    MAX_ARRAY_LENGTH: 1000, MAX_OBJECT_DEPTH: 20,
  },
  errorCodes,
  limits,
  patterns,
};

const utils = { initializeFramework, getFrameworkConfig, resetFrameworkConfig, formatValidationError };

module.exports = {
  schemas,
  middleware,
  validators,
  constants,
  utils,
  initializeFramework,
  getFrameworkConfig,
  resetFrameworkConfig,
  formatValidationError,
  validate: validationMiddleware.validate,
  validateRequest: validationMiddleware.validateRequest,
  createValidator: validationMiddleware.createValidator,
  createMultiValidator: validationMiddleware.createMultiValidator,
  mongoIdSchema: baseSchemas.mongoIdSchema,
  authSchemas,
  userSchemas,
  shipmentSchemas,
  financeSchemas,
  disputeSchemas,
  supportSchemas,
  reportSchemas,
  settingsSchemas,
  notificationSchemas,
  rateSchemas,
  errorCodes,
  limits,
  patterns,
};
