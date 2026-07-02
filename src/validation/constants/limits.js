/**
 * Validation Limits and Constraints
 * Defines all validation limits for security, performance, and business rules.
 * Used by validators, middleware, and error formatters for consistent enforcement.
 * 
 * Task 1.3: Set up validation constants, patterns, and error codes
 * Requirements: R7.1, R7.2
 * - Validation limits for security and performance
 * - Comprehensive constraints for all business domains
 */

// String length limits
const STRING_LIMITS = {
  // Basic string fields
  SHORT_TEXT: {
    min: 1,
    max: 50
  },
  MEDIUM_TEXT: {
    min: 1,
    max: 200
  },
  LONG_TEXT: {
    min: 1,
    max: 1000
  },
  DESCRIPTION: {
    min: 10,
    max: 2000
  },
  
  // Specific field limits
  EMAIL: {
    min: 5,
    max: 254 // RFC 5321 standard
  },
  PASSWORD: {
    min: 8,
    max: 128
  },
  PHONE: {
    min: 10,
    max: 15 // E.164 international format
  },
  NAME: {
    min: 2,
    max: 100
  },
  ADDRESS_LINE: {
    min: 10,
    max: 200
  },
  CITY: {
    min: 2,
    max: 50
  },
  STATE: {
    min: 2,
    max: 50
  },
  COUNTRY: {
    min: 2,
    max: 50
  },
  COMPANY_NAME: {
    min: 2,
    max: 100
  },
  
  // Content fields
  COMMENT: {
    min: 1,
    max: 500
  },
  REASON: {
    min: 10,
    max: 300
  },
  NOTES: {
    min: 1,
    max: 1000
  },
  
  // Identifiers
  REFERENCE_ID: {
    min: 3,
    max: 50
  },
  TRACKING_ID: {
    min: 8,
    max: 30
  },
  ORDER_ID: {
    min: 6,
    max: 25
  }
};

// Numeric limits
const NUMERIC_LIMITS = {
  // Financial amounts (in paise/smallest currency unit)
  MONEY: {
    min: 0,
    max: 10000000, // ₹100,000 (1 lakh)
    precision: 2
  },
  
  // Shipment-related limits
  WEIGHT: {
    min: 0.001, // 1 gram
    max: 50, // 50 kg maximum
    precision: 3
  },
  DIMENSIONS: {
    min: 1, // 1 cm
    max: 200, // 200 cm (2 meters)
    precision: 2
  },
  DECLARED_VALUE: {
    min: 100, // ₹1 minimum
    max: 10000000, // ₹100,000 maximum
    precision: 2
  },
  COD_AMOUNT: {
    min: 100, // ₹1 minimum COD
    max: 5000000, // ₹50,000 maximum COD
    precision: 2
  },
  
  // Pagination limits
  PAGE_SIZE: {
    min: 1,
    max: 100,
    default: 10
  },
  PAGE_NUMBER: {
    min: 1,
    max: 10000,
    default: 1
  },
  
  // User limits
  OTP: {
    min: 100000, // 6-digit OTP
    max: 999999
  },
  PIN_CODE: {
    min: 100000, // Indian PIN codes
    max: 999999
  },
  
  // Rate limits
  REQUESTS_PER_MINUTE: {
    default: 60,
    auth: 10, // Login attempts
    upload: 5, // File uploads
    admin: 120 // Admin operations
  },
  
  // Commission and rates
  COMMISSION_RATE: {
    min: 0,
    max: 50, // 50% maximum commission
    precision: 2
  },
  TAX_RATE: {
    min: 0,
    max: 30, // 30% maximum tax
    precision: 2
  },
  DISCOUNT_RATE: {
    min: 0,
    max: 100, // 100% maximum discount
    precision: 2
  }
};

// Array limits
const ARRAY_LIMITS = {
  // File uploads
  FILES: {
    max: 10,
    default: 1
  },
  
  // Bulk operations
  BULK_CREATE: {
    max: 100
  },
  BULK_UPDATE: {
    max: 50
  },
  BULK_DELETE: {
    max: 20
  },
  
  // Query filters
  FILTER_VALUES: {
    max: 20
  },
  SORT_FIELDS: {
    max: 5
  },
  
  // User selections
  SELECTED_ITEMS: {
    max: 100
  },
  
  // Address book
  ADDRESSES: {
    max: 10
  },
  
  // Notification preferences
  NOTIFICATION_TYPES: {
    max: 20
  }
};

// File size limits (in bytes)
const FILE_LIMITS = {
  // Image uploads
  PROFILE_PICTURE: {
    maxSize: 2 * 1024 * 1024, // 2 MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
  },
  
  // Document uploads
  DOCUMENT: {
    maxSize: 10 * 1024 * 1024, // 10 MB
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png']
  },
  
  // CSV data files
  CSV_UPLOAD: {
    maxSize: 50 * 1024 * 1024, // 50 MB
    allowedTypes: ['text/csv', 'application/vnd.ms-excel'],
    maxRows: 10000
  },
  
  // Evidence files for disputes
  EVIDENCE: {
    maxSize: 25 * 1024 * 1024, // 25 MB
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf', 'video/mp4'],
    maxFiles: 5
  },
  
  // Support ticket attachments
  SUPPORT_ATTACHMENT: {
    maxSize: 15 * 1024 * 1024, // 15 MB
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'],
    maxFiles: 3
  },
  
  // General file upload
  GENERAL: {
    maxSize: 5 * 1024 * 1024, // 5 MB
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxFiles: 1
  }
};

// Time-based limits
const TIME_LIMITS = {
  // Session timeouts (in seconds)
  SESSION_TIMEOUT: 24 * 60 * 60, // 24 hours
  ADMIN_SESSION_TIMEOUT: 8 * 60 * 60, // 8 hours
  
  // OTP validity (in seconds)
  OTP_VALIDITY: 5 * 60, // 5 minutes
  
  // Token expiry
  ACCESS_TOKEN_EXPIRY: 15 * 60, // 15 minutes
  REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60, // 7 days
  
  // Rate limiting windows
  RATE_LIMIT_WINDOW: 60, // 1 minute
  
  // Dispute resolution timeouts
  DISPUTE_RESPONSE_TIME: 48 * 60 * 60, // 48 hours
  AUTO_CLOSE_DISPUTE: 7 * 24 * 60 * 60, // 7 days
  
  // Shipment timeouts
  PICKUP_TIMEOUT: 24 * 60 * 60, // 24 hours
  DELIVERY_TIMEOUT: 72 * 60 * 60, // 72 hours
  
  // Cache timeouts
  VALIDATION_CACHE: 60 * 60, // 1 hour
  SCHEMA_CACHE: 24 * 60 * 60 // 24 hours
};

// Business rule limits
const BUSINESS_LIMITS = {
  // Wallet and financial limits
  WALLET: {
    MIN_BALANCE: 0,
    MAX_BALANCE: 100000000, // ₹10 lakh
    DAILY_TRANSACTION_LIMIT: 5000000, // ₹50,000
    MONTHLY_TRANSACTION_LIMIT: 50000000, // ₹5 lakh
    MIN_WITHDRAWAL: 10000, // ₹100
    MAX_WITHDRAWAL: 2500000 // ₹25,000
  },
  
  // Shipment business rules
  SHIPMENT: {
    MAX_PACKAGES_PER_SHIPMENT: 10,
    MIN_DELIVERY_DISTANCE: 1, // 1 km
    MAX_DELIVERY_DISTANCE: 2000, // 2000 km
    MAX_COD_PERCENTAGE: 90, // 90% of declared value
    MIN_INSURANCE_VALUE: 50000, // ₹500
    MAX_INSURANCE_VALUE: 5000000, // ₹50,000
    VOLUMETRIC_WEIGHT_DIVISOR: 5000 // Industry standard
  },
  
  // User hierarchy limits
  USER_HIERARCHY: {
    MAX_DISTRIBUTOR_MERCHANTS: 100,
    MAX_MERCHANT_WAREHOUSES: 20,
    MAX_HIERARCHY_DEPTH: 3,
    MIN_COMMISSION_DIFFERENCE: 1 // 1% minimum difference between levels
  },
  
  // Order processing limits
  ORDER: {
    MAX_ORDERS_PER_DAY: 1000,
    MAX_ORDERS_PER_HOUR: 100,
    BULK_ORDER_LIMIT: 50,
    AUTO_CANCEL_TIMEOUT: 30 * 60 // 30 minutes
  },
  
  // Dispute limits
  DISPUTE: {
    MAX_DISPUTES_PER_SHIPMENT: 3,
    MAX_EVIDENCE_FILES: 10,
    MAX_COMMENTS: 50,
    ESCALATION_TIMEOUT: 72 * 60 * 60, // 72 hours
    MAX_RESOLUTION_ATTEMPTS: 5
  }
};

// Security constraints
const SECURITY_LIMITS = {
  // Password requirements
  PASSWORD_RULES: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxConsecutiveChars: 3,
    preventCommonPasswords: true,
    preventPersonalInfo: true
  },
  
  // Account security
  LOGIN_ATTEMPTS: {
    maxAttempts: 5,
    lockoutDuration: 30 * 60, // 30 minutes
    progressiveLockout: true
  },
  
  // API security
  API_LIMITS: {
    maxRequestSize: 100 * 1024 * 1024, // 100 MB
    maxHeaderSize: 8192, // 8 KB
    maxUrlLength: 2048, // 2 KB
    maxQueryParams: 50,
    maxFormFields: 1000
  },
  
  // Input sanitization
  INPUT_LIMITS: {
    maxNestingDepth: 10,
    maxArrayLength: 1000,
    maxObjectKeys: 100,
    maxStringLength: 100000,
    preventScriptTags: true,
    preventSqlKeywords: true
  },
  
  // IP and geographic restrictions
  IP_LIMITS: {
    maxRequestsPerIP: 1000,
    blockSuspiciousIPs: true,
    allowedCountries: ['IN'], // India only for now
    vpnDetection: true
  }
};

// Performance optimization limits
const PERFORMANCE_LIMITS = {
  // Database query limits
  DATABASE: {
    maxQueryTime: 5000, // 5 seconds
    maxResultSize: 1000,
    maxJoinDepth: 3,
    enableQueryCache: true,
    cacheTimeout: 300 // 5 minutes
  },
  
  // Memory limits
  MEMORY: {
    maxRequestMemory: 50 * 1024 * 1024, // 50 MB per request
    maxCacheSize: 100 * 1024 * 1024, // 100 MB cache
    gcThreshold: 0.8 // Trigger GC at 80% memory
  },
  
  // Processing limits
  PROCESSING: {
    maxConcurrentRequests: 100,
    maxProcessingTime: 30000, // 30 seconds
    maxCpuUsage: 80, // 80% CPU usage
    enableRateScaling: true
  }
};

/**
 * Get limit configuration for a specific domain
 * @param {string} domain - The domain name (e.g., 'STRING', 'NUMERIC', 'FILE')
 * @param {string} field - The specific field name
 * @returns {object|null} Limit configuration or null if not found
 */
const getLimit = (domain, field) => {
  const domainLimits = {
    STRING: STRING_LIMITS,
    NUMERIC: NUMERIC_LIMITS,
    ARRAY: ARRAY_LIMITS,
    FILE: FILE_LIMITS,
    TIME: TIME_LIMITS,
    BUSINESS: BUSINESS_LIMITS,
    SECURITY: SECURITY_LIMITS,
    PERFORMANCE: PERFORMANCE_LIMITS
  };
  
  const limits = domainLimits[domain.toUpperCase()];
  return limits ? limits[field] : null;
};

/**
 * Check if value is within specified limits with detailed error information
 * @param {any} value - Value to check
 * @param {object} limits - Limit configuration
 * @param {string} type - Type of validation ('length', 'range', 'size')
 * @param {string} fieldName - Name of the field being validated
 * @returns {object} Validation result with isValid, error, and metadata
 */
const validateLimit = (value, limits, type = 'range', fieldName = 'field') => {
  if (!limits) {
    return { isValid: true };
  }
  
  const result = {
    isValid: false,
    error: null,
    actualValue: null,
    expectedRange: null,
    fieldName: fieldName
  };
  
  switch (type) {
    case 'length':
      if (typeof value === 'string' || Array.isArray(value)) {
        const length = value.length;
        result.actualValue = length;
        result.expectedRange = { min: limits.min, max: limits.max };
        
        if (limits.min !== undefined && length < limits.min) {
          result.error = `Minimum length for ${fieldName} is ${limits.min} characters, got ${length}`;
          return result;
        }
        if (limits.max !== undefined && length > limits.max) {
          result.error = `${fieldName} must be no more than ${limits.max} characters, got ${length}`;
          return result;
        }
        result.isValid = true;
      } else {
        result.error = `${fieldName} must be a string or array for length validation`;
      }
      break;
      
    case 'range':
      if (typeof value === 'number') {
        result.actualValue = value;
        result.expectedRange = { min: limits.min, max: limits.max };
        
        if (limits.min !== undefined && value < limits.min) {
          result.error = `${fieldName} must be at least ${limits.min}, got ${value}`;
          return result;
        }
        if (limits.max !== undefined && value > limits.max) {
          result.error = `${fieldName} must be no more than ${limits.max}, got ${value}`;
          return result;
        }
        
        // Check precision for decimal numbers
        if (limits.precision !== undefined && value % 1 !== 0) {
          const decimalPlaces = (value.toString().split('.')[1] || '').length;
          if (decimalPlaces > limits.precision) {
            result.error = `${fieldName} cannot have more than ${limits.precision} decimal places, got ${decimalPlaces}`;
            return result;
          }
        }
        
        result.isValid = true;
      } else {
        result.error = `${fieldName} must be a number for range validation`;
      }
      break;
      
    case 'size':
      result.actualValue = value;
      result.expectedRange = { max: limits.maxSize };
      
      if (limits.maxSize !== undefined && value > limits.maxSize) {
        const sizeInMB = (value / (1024 * 1024)).toFixed(2);
        const limitInMB = (limits.maxSize / (1024 * 1024)).toFixed(2);
        result.error = `${fieldName} size ${sizeInMB}MB exceeds maximum ${limitInMB}MB`;
        return result;
      }
      result.isValid = true;
      break;
      
    default:
      result.error = `Unknown validation type: ${type}`;
  }
  
  return result;
};

/**
 * Get limits with environment-specific overrides
 * @param {string} domain - The domain name
 * @param {string} field - The field name  
 * @param {string} environment - Environment (development, production, test)
 * @returns {object|null} Limit configuration with environment overrides
 */
const getLimitWithEnvironment = (domain, field, environment = 'production') => {
  const baseLimit = getLimit(domain, field);
  if (!baseLimit) return null;
  
  // Environment-specific overrides
  const envOverrides = {
    development: {
      // More lenient limits in development
      multiplier: 1.5,
      additionalTime: 30
    },
    test: {
      // Stricter limits for testing
      multiplier: 0.8,
      maxFileSize: 1024 * 1024 // 1MB max in tests
    }
  };
  
  const override = envOverrides[environment];
  if (!override) return baseLimit;
  
  const adjustedLimit = { ...baseLimit };
  
  // Apply multipliers for numeric limits
  if (override.multiplier && typeof baseLimit.max === 'number') {
    adjustedLimit.max = Math.floor(baseLimit.max * override.multiplier);
  }
  
  // Apply file size overrides
  if (override.maxFileSize && baseLimit.maxSize) {
    adjustedLimit.maxSize = Math.min(baseLimit.maxSize, override.maxFileSize);
  }
  
  return adjustedLimit;
};

/**
 * Get default value for a field if specified in limits
 * @param {string} domain - The domain name
 * @param {string} field - The field name
 * @returns {any} Default value or undefined
 */
const getDefaultValue = (domain, field) => {
  const limits = getLimit(domain, field);
  return limits ? limits.default : undefined;
};

module.exports = {
  STRING_LIMITS,
  NUMERIC_LIMITS,
  ARRAY_LIMITS,
  FILE_LIMITS,
  TIME_LIMITS,
  BUSINESS_LIMITS,
  SECURITY_LIMITS,
  PERFORMANCE_LIMITS,
  getLimit,
  validateLimit,
  getDefaultValue,
  getLimitWithEnvironment
};
