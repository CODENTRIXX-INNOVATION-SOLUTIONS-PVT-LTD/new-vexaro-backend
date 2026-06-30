'use strict';

/**
 * Enterprise Validation Framework - Error Response Formatter
 * 
 * Provides consistent, enterprise-grade error response formatting across all validation
 * failures. Implements requirements R7.1, R7.3, and R7.4 for standardized error handling
 * with security-aware disclosure and localization support.
 * 
 * @module ErrorFormatter
 */

const { z } = require('zod');

// ─── Error Formatting Configuration ────────────────────────────────────────────

/**
 * Default error formatting configuration
 */
const DEFAULT_ERROR_CONFIG = {
  includeStackTrace: false,
  maxErrorsShown: 20,
  truncateValueLength: 100,
  redactSensitiveFields: true,
  includeErrorCodes: true,
  includeFieldPath: true,
  enableLocalization: false,
  defaultLocale: 'en',
  timestampFormat: 'ISO',
  requestIdGeneration: true,
};

/**
 * Sensitive field patterns for security-aware error disclosure (R7.4)
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /auth/i,
  /credential/i,
  /otp/i,
  /pin/i,
  /ssn/i,
  /account/i,
  /card/i,
  /cvv/i,
  /signature/i,
];

/**
 * Error severity levels for categorization
 */
const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

/**
 * Standard error categories for consistent classification
 */
const ERROR_CATEGORIES = {
  VALIDATION: 'validation',
  BUSINESS_RULE: 'business_rule', 
  SECURITY: 'security',
  AUTHORIZATION: 'authorization',
  RATE_LIMIT: 'rate_limit',
  FILE_UPLOAD: 'file_upload',
  SYSTEM: 'system',
};

// ─── Localization Support ──────────────────────────────────────────────────────

/**
 * Error message templates by locale (R7.3)
 */
const ERROR_MESSAGES = {
  en: {
    VALIDATION_FAILED: 'Validation failed',
    FIELD_REQUIRED: 'This field is required',
    FIELD_INVALID: 'Invalid field value',
    TYPE_MISMATCH: 'Field type is incorrect',
    LENGTH_EXCEEDED: 'Field length exceeds maximum allowed',
    LENGTH_INSUFFICIENT: 'Field length is below minimum required',
    FORMAT_INVALID: 'Field format is invalid',
    ENUM_INVALID: 'Value must be one of the allowed options',
    BUSINESS_RULE_VIOLATION: 'Business rule validation failed',
    SECURITY_VIOLATION: 'Security validation failed',
    UNKNOWN_ERROR: 'An unknown validation error occurred',
  },
  es: {
    VALIDATION_FAILED: 'Validación fallida',
    FIELD_REQUIRED: 'Este campo es obligatorio',
    FIELD_INVALID: 'Valor de campo inválido',
    TYPE_MISMATCH: 'El tipo de campo es incorrecto',
    LENGTH_EXCEEDED: 'La longitud del campo excede el máximo permitido',
    LENGTH_INSUFFICIENT: 'La longitud del campo está por debajo del mínimo requerido',
    FORMAT_INVALID: 'El formato del campo es inválido',
    ENUM_INVALID: 'El valor debe ser una de las opciones permitidas',
    BUSINESS_RULE_VIOLATION: 'Falló la validación de regla de negocio',
    SECURITY_VIOLATION: 'Falló la validación de seguridad',
    UNKNOWN_ERROR: 'Ocurrió un error de validación desconocido',
  },
  hi: {
    VALIDATION_FAILED: 'सत्यापन असफल',
    FIELD_REQUIRED: 'यह फ़ील्ड आवश्यक है',
    FIELD_INVALID: 'अमान्य फ़ील्ड मान',
    TYPE_MISMATCH: 'फ़ील्ड प्रकार गलत है',
    LENGTH_EXCEEDED: 'फ़ील्ड लंबाई अधिकतम अनुमतित से अधिक है',
    LENGTH_INSUFFICIENT: 'फ़ील्ड लंबाई न्यूनतम आवश्यक से कम है',
    FORMAT_INVALID: 'फ़ील्ड प्रारूप अमान्य है',
    ENUM_INVALID: 'मान अनुमतित विकल्पों में से एक होना चाहिए',
    BUSINESS_RULE_VIOLATION: 'व्यापार नियम सत्यापन असफल',
    SECURITY_VIOLATION: 'सुरक्षा सत्यापन असफल',
    UNKNOWN_ERROR: 'एक अज्ञात सत्यापन त्रुटि हुई',
  },
};

// ─── Core Error Formatting Functions ───────────────────────────────────────────

/**
 * Format validation errors with consistent structure and security awareness
 * Implements R7.1 (consistent error format) and R7.4 (security-aware disclosure)
 * 
 * @param {Error|Object} error - Error object to format
 * @param {Object} options - Formatting options
 * @param {string} [options.requestId] - Request ID for tracking
 * @param {string} [options.locale='en'] - Locale for error messages
 * @param {string} [options.format='detailed'] - Error format ('detailed' | 'simple')
 * @param {boolean} [options.includeStackTrace=false] - Include stack trace
 * @param {Object} [options.context] - Additional context information
 * @returns {Object} Formatted error response
 */
function formatValidationError(error, options = {}) {
  const config = { ...DEFAULT_ERROR_CONFIG, ...options };
  const requestId = options.requestId || generateRequestId();
  const locale = options.locale || config.defaultLocale;
  const timestamp = formatTimestamp(new Date(), config.timestampFormat);
  
  // Base error response structure
  const baseResponse = {
    success: false,
    error: 'ValidationError',
    requestId,
    timestamp,
    locale,
  };
  
  // Handle different error types
  if (error instanceof z.ZodError) {
    return formatZodError(error, baseResponse, config, locale);
  }
  
  if (error && error.name === 'ValidationError') {
    return formatCustomValidationError(error, baseResponse, config, locale);
  }
  
  if (error && error.type === 'BusinessRuleError') {
    return formatBusinessRuleError(error, baseResponse, config, locale);
  }
  
  if (error && error.type === 'SecurityError') {
    return formatSecurityError(error, baseResponse, config, locale);
  }
  
  // Handle unknown errors
  return formatUnknownError(error, baseResponse, config, locale);
}

/**
 * Format Zod validation errors with detailed field information
 * @private
 */
function formatZodError(zodError, baseResponse, config, locale) {
  const errors = zodError.issues
    .slice(0, config.maxErrorsShown)
    .map(issue => formatZodIssue(issue, config, locale));
  
  const response = {
    ...baseResponse,
    message: getLocalizedMessage('VALIDATION_FAILED', locale),
    category: ERROR_CATEGORIES.VALIDATION,
    severity: ERROR_SEVERITY.MEDIUM,
    errors,
    errorCount: zodError.issues.length,
  };
  
  if (zodError.issues.length > config.maxErrorsShown) {
    response.truncated = true;
    response.totalErrors = zodError.issues.length;
  }
  
  if (config.includeStackTrace && zodError.stack) {
    response.stack = zodError.stack;
  }
  
  return response;
}

/**
 * Format individual Zod issue with security awareness
 * @private
 */
function formatZodIssue(issue, config, locale) {
  const fieldPath = issue.path.join('.') || 'root';
  const isSensitive = isSensitiveField(fieldPath, issue.received);
  
  const formattedIssue = {
    field: fieldPath,
    code: mapZodCodeToStandard(issue.code),
    message: getZodErrorMessage(issue, locale),
  };
  
  // Add field value if not sensitive (R7.4)
  if (!isSensitive && config.includeFieldPath) {
    formattedIssue.received = sanitizeValue(issue.received ?? null, config.truncateValueLength);
  }
  
  // Add expected value for certain error types
  if (issue.expected && !isSensitive) {
    formattedIssue.expected = issue.expected;
  }
  
  // Add additional context for specific error types
  if (issue.code === 'invalid_enum_value' && issue.options) {
    formattedIssue.allowedValues = issue.options;
  }
  
  if (issue.code === 'too_small' || issue.code === 'too_big') {
    formattedIssue.limit = issue.minimum ?? issue.maximum;
    formattedIssue.inclusive = issue.inclusive;
  }
  
  return formattedIssue;
}

/**
 * Format custom validation errors
 * @private
 */
function formatCustomValidationError(error, baseResponse, config, locale) {
  const errors = Array.isArray(error.errors) ? error.errors : [
    {
      field: error.field || 'general',
      code: error.code || 'VALIDATION_FAILED',
      message: error.message || getLocalizedMessage('FIELD_INVALID', locale),
    }
  ];
  
  return {
    ...baseResponse,
    message: error.message || getLocalizedMessage('VALIDATION_FAILED', locale),
    category: error.category || ERROR_CATEGORIES.VALIDATION,
    severity: error.severity || ERROR_SEVERITY.MEDIUM,
    errors: errors.slice(0, config.maxErrorsShown),
    errorCount: errors.length,
  };
}

/**
 * Format business rule validation errors
 * @private
 */
function formatBusinessRuleError(error, baseResponse, config, locale) {
  return {
    ...baseResponse,
    message: error.message || getLocalizedMessage('BUSINESS_RULE_VIOLATION', locale),
    category: ERROR_CATEGORIES.BUSINESS_RULE,
    severity: error.severity || ERROR_SEVERITY.HIGH,
    rule: error.rule,
    context: sanitizeContext(error.context),
    errors: [{
      field: error.field || 'business_rule',
      code: error.code || 'BUSINESS_RULE_VIOLATION',
      message: error.message || getLocalizedMessage('BUSINESS_RULE_VIOLATION', locale),
    }],
    errorCount: 1,
  };
}

/**
 * Format security validation errors with minimal disclosure (R7.4)
 * @private
 */
function formatSecurityError(error, baseResponse, config, locale) {
  // Minimal information for security errors to prevent information leakage
  return {
    ...baseResponse,
    message: getLocalizedMessage('SECURITY_VIOLATION', locale),
    category: ERROR_CATEGORIES.SECURITY,
    severity: ERROR_SEVERITY.CRITICAL,
    errors: [{
      field: 'security',
      code: 'SECURITY_VIOLATION',
      message: getLocalizedMessage('SECURITY_VIOLATION', locale),
    }],
    errorCount: 1,
    // Security errors should not expose detailed information
  };
}

/**
 * Format unknown errors safely
 * @private
 */
function formatUnknownError(error, baseResponse, config, locale) {
  return {
    ...baseResponse,
    message: getLocalizedMessage('UNKNOWN_ERROR', locale),
    category: ERROR_CATEGORIES.SYSTEM,
    severity: ERROR_SEVERITY.MEDIUM,
    errors: [{
      field: 'general',
      code: 'UNKNOWN_ERROR', 
      message: error?.message || getLocalizedMessage('UNKNOWN_ERROR', locale),
    }],
    errorCount: 1,
  };
}

// ─── Helper Functions ───────────────────────────────────────────────────────────

/**
 * Check if a field contains sensitive information (R7.4)
 * @private
 */
function isSensitiveField(fieldPath, value) {
  // Check field name against sensitive patterns
  const fieldName = fieldPath.toLowerCase();
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(fieldName)) {
      return true;
    }
  }
  
  // Check value content for potential sensitive data
  if (typeof value === 'string') {
    // Check for common sensitive value patterns
    const sensitiveValuePatterns = [
      /^\d{4}\s?\d{4}\s?\d{4}\s?\d{4}$/, // Credit card
      /^[A-Za-z0-9+/=]{20,}$/, // Base64 encoded (potential token)
      /^[0-9a-fA-F]{32,}$/, // Hex encoded (potential hash/key)
    ];
    
    for (const pattern of sensitiveValuePatterns) {
      if (pattern.test(value)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Sanitize value for error display
 * @private
 */
function sanitizeValue(value, maxLength) {
  if (value === null || value === undefined) {
    return value;
  }
  
  if (typeof value === 'string') {
    if (value.length > maxLength) {
      return `${value.substring(0, maxLength)}...`;
    }
    return value;
  }
  
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  
  if (typeof value === 'object') {
    return `Object(${Object.keys(value).length} properties)`;
  }
  
  return String(value);
}

/**
 * Sanitize context information to remove sensitive data
 * @private
 */
function sanitizeContext(context) {
  if (!context || typeof context !== 'object') {
    return context;
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(context)) {
    if (isSensitiveField(key, value)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = (typeof value === 'number' || typeof value === 'boolean')
        ? value
        : sanitizeValue(value, 100);
    }
  }
  
  return sanitized;
}

/**
 * Map Zod error codes to standardized codes
 * @private
 */
function mapZodCodeToStandard(zodCode) {
  const codeMapping = {
    invalid_type: 'TYPE_MISMATCH',
    invalid_literal: 'VALUE_MISMATCH',
    invalid_enum_value: 'ENUM_INVALID',
    unrecognized_keys: 'UNKNOWN_FIELDS',
    invalid_arguments: 'INVALID_ARGUMENTS',
    invalid_return_type: 'INVALID_RETURN',
    invalid_date: 'DATE_INVALID',
    invalid_string: 'STRING_INVALID',
    invalid_format: 'STRING_INVALID',
    too_small: 'LENGTH_INSUFFICIENT',
    too_big: 'LENGTH_EXCEEDED',
    invalid_intersection_types: 'INTERSECTION_INVALID',
    not_multiple_of: 'NOT_MULTIPLE',
    not_finite: 'NOT_FINITE',
    custom: 'CUSTOM_VALIDATION',
  };
  
  return codeMapping[zodCode] || 'VALIDATION_FAILED';
}

/**
 * Get localized error message for Zod issues
 * @private
 */
function getZodErrorMessage(issue, locale) {
  const messages = ERROR_MESSAGES[locale] || ERROR_MESSAGES.en;
  
  switch (issue.code) {
    case 'invalid_type':
      return `Expected ${issue.expected}, received ${issue.received}`;
    case 'too_small':
      return issue.type === 'string' 
        ? messages.LENGTH_INSUFFICIENT
        : `Value must be at least ${issue.minimum}`;
    case 'too_big':
      return issue.type === 'string'
        ? messages.LENGTH_EXCEEDED  
        : `Value must be at most ${issue.maximum}`;
    case 'invalid_enum_value':
      return messages.ENUM_INVALID;
    case 'custom':
      return issue.message || messages.FIELD_INVALID;
    default:
      return issue.message || messages.FIELD_INVALID;
  }
}

/**
 * Get localized message by key
 * @private
 */
function getLocalizedMessage(key, locale) {
  const messages = ERROR_MESSAGES[locale] || ERROR_MESSAGES.en;
  return messages[key] || messages.UNKNOWN_ERROR;
}

/**
 * Generate unique request ID for error tracking
 * @private
 */
function generateRequestId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `req_${timestamp}_${random}`;
}

/**
 * Format timestamp according to specified format
 * @private
 */
function formatTimestamp(date, format) {
  switch (format) {
    case 'ISO':
      return date.toISOString();
    case 'epoch':
      return date.getTime();
    case 'local':
      return date.toLocaleString();
    default:
      return date.toISOString();
  }
}

// ─── Specialized Error Formatters ──────────────────────────────────────────────

/**
 * Format file upload validation errors
 * 
 * @param {Object} error - File upload error
 * @param {Object} options - Formatting options
 * @returns {Object} Formatted file upload error
 */
function formatFileUploadError(error, options = {}) {
  const enhancedError = {
    ...error,
    name: 'ValidationError',
    type: 'FileUploadError',
    category: ERROR_CATEGORIES.FILE_UPLOAD,
    severity: ERROR_SEVERITY.MEDIUM,
  };
  
  return formatValidationError(enhancedError, options);
}

/**
 * Format rate limiting errors
 * 
 * @param {Object} error - Rate limit error
 * @param {Object} options - Formatting options  
 * @returns {Object} Formatted rate limit error
 */
function formatRateLimitError(error, options = {}) {
  const enhancedError = {
    ...error,
    name: 'ValidationError',
    type: 'RateLimitError',
    category: ERROR_CATEGORIES.RATE_LIMIT,
    severity: ERROR_SEVERITY.HIGH,
    message: error.message || 'Rate limit exceeded. Please try again later.',
  };
  
  return formatValidationError(enhancedError, options);
}

/**
 * Format authorization errors with minimal information disclosure
 * 
 * @param {Object} error - Authorization error
 * @param {Object} options - Formatting options
 * @returns {Object} Formatted authorization error
 */
function formatAuthorizationError(error, options = {}) {
  const enhancedError = {
    ...error,
    name: 'ValidationError',
    type: 'AuthorizationError',
    category: ERROR_CATEGORIES.AUTHORIZATION,
    severity: ERROR_SEVERITY.HIGH,
    message: error.message || 'Access denied. Insufficient permissions.',
  };
  
  return formatValidationError(enhancedError, options);
}

// ─── Configuration and Utility Functions ────────────────────────────────────────

/**
 * Create custom error formatter with specific configuration
 * 
 * @param {Object} config - Custom configuration
 * @returns {Function} Configured error formatter function
 */
function createErrorFormatter(config = {}) {
  const mergedConfig = { ...DEFAULT_ERROR_CONFIG, ...config };
  
  return (error, options = {}) => {
    return formatValidationError(error, { ...mergedConfig, ...options });
  };
}

/**
 * Get available locales for error messages
 * 
 * @returns {Array<string>} Array of supported locale codes
 */
function getAvailableLocales() {
  return Object.keys(ERROR_MESSAGES);
}

/**
 * Add custom error message templates for a locale
 * 
 * @param {string} locale - Locale code (e.g., 'fr', 'de')
 * @param {Object} messages - Message templates
 */
function addLocaleMessages(locale, messages) {
  ERROR_MESSAGES[locale] = { ...ERROR_MESSAGES.en, ...messages };
}

// ─── Main Exports ───────────────────────────────────────────────────────────────

module.exports = {
  // Core formatting functions
  formatValidationError,
  formatFileUploadError,
  formatRateLimitError,
  formatAuthorizationError,
  
  // Configuration functions
  createErrorFormatter,
  
  // Localization functions (R7.3)
  getAvailableLocales,
  addLocaleMessages,
  getLocalizedMessage,
  
  // Utility functions
  generateRequestId,
  isSensitiveField,
  sanitizeValue,
  
  // Constants for external use
  ERROR_SEVERITY,
  ERROR_CATEGORIES,
  DEFAULT_ERROR_CONFIG,
  SENSITIVE_PATTERNS,
  
  // Error message templates (for external extension)
  ERROR_MESSAGES,
};
