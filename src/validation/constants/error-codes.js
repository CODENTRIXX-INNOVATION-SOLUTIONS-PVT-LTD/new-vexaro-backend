/**
 * Standardized Validation Error Codes
 * Provides consistent error codes for all validation scenarios across the application.
 * Supports internationalization and localization through structured error definitions.
 * 
 * Task 1.3: Set up validation constants, patterns, and error codes
 * Requirements: R7.1, R7.2
 * - Comprehensive error codes for all validation scenarios
 * - Constants support internationalization and localization
 */

// Base validation error codes
const BASE_ERROR_CODES = {
  // Generic validation errors
  REQUIRED: 'REQUIRED',
  INVALID_TYPE: 'INVALID_TYPE',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_LENGTH: 'INVALID_LENGTH',
  INVALID_RANGE: 'INVALID_RANGE',
  INVALID_ENUM: 'INVALID_ENUM',
  
  // String validation errors
  STRING_TOO_SHORT: 'STRING_TOO_SHORT',
  STRING_TOO_LONG: 'STRING_TOO_LONG',
  STRING_INVALID_CHARACTERS: 'STRING_INVALID_CHARACTERS',
  STRING_PATTERN_MISMATCH: 'STRING_PATTERN_MISMATCH',
  
  // Number validation errors
  NUMBER_TOO_SMALL: 'NUMBER_TOO_SMALL',
  NUMBER_TOO_LARGE: 'NUMBER_TOO_LARGE',
  NUMBER_NOT_INTEGER: 'NUMBER_NOT_INTEGER',
  NUMBER_INVALID_PRECISION: 'NUMBER_INVALID_PRECISION',
  
  // Array validation errors
  ARRAY_TOO_SHORT: 'ARRAY_TOO_SHORT',
  ARRAY_TOO_LONG: 'ARRAY_TOO_LONG',
  ARRAY_INVALID_ITEM: 'ARRAY_INVALID_ITEM',
  ARRAY_DUPLICATE_ITEMS: 'ARRAY_DUPLICATE_ITEMS',
  
  // Object validation errors
  OBJECT_MISSING_PROPERTY: 'OBJECT_MISSING_PROPERTY',
  OBJECT_EXTRA_PROPERTY: 'OBJECT_EXTRA_PROPERTY',
  OBJECT_INVALID_PROPERTY: 'OBJECT_INVALID_PROPERTY'
};

// Domain-specific error codes
const DOMAIN_ERROR_CODES = {
  // Authentication & Authorization
  AUTH: {
    INVALID_EMAIL: 'AUTH_INVALID_EMAIL',
    INVALID_PASSWORD: 'AUTH_INVALID_PASSWORD',
    PASSWORD_TOO_WEAK: 'AUTH_PASSWORD_TOO_WEAK',
    PASSWORD_MISSING_UPPERCASE: 'AUTH_PASSWORD_MISSING_UPPERCASE',
    PASSWORD_MISSING_LOWERCASE: 'AUTH_PASSWORD_MISSING_LOWERCASE',
    PASSWORD_MISSING_NUMBER: 'AUTH_PASSWORD_MISSING_NUMBER',
    PASSWORD_MISSING_SPECIAL: 'AUTH_PASSWORD_MISSING_SPECIAL',
    INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
    TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
    INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
    ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
    INVALID_OTP: 'AUTH_INVALID_OTP',
    OTP_EXPIRED: 'AUTH_OTP_EXPIRED'
  },

  // User Management
  USER: {
    INVALID_PHONE: 'USER_INVALID_PHONE',
    PHONE_ALREADY_EXISTS: 'USER_PHONE_ALREADY_EXISTS',
    EMAIL_ALREADY_EXISTS: 'USER_EMAIL_ALREADY_EXISTS',
    INVALID_USER_TYPE: 'USER_INVALID_USER_TYPE',
    INVALID_USER_STATUS: 'USER_INVALID_USER_STATUS',
    INVALID_HIERARCHY: 'USER_INVALID_HIERARCHY',
    PARENT_NOT_FOUND: 'USER_PARENT_NOT_FOUND',
    INVALID_PARENT_TYPE: 'USER_INVALID_PARENT_TYPE',
    CIRCULAR_HIERARCHY: 'USER_CIRCULAR_HIERARCHY',
    INVALID_PERMISSIONS: 'USER_INVALID_PERMISSIONS'
  },

  // Shipment Management
  SHIPMENT: {
    INVALID_WEIGHT: 'SHIPMENT_INVALID_WEIGHT',
    WEIGHT_EXCEEDS_LIMIT: 'SHIPMENT_WEIGHT_EXCEEDS_LIMIT',
    INVALID_DIMENSIONS: 'SHIPMENT_INVALID_DIMENSIONS',
    INVALID_SERVICE_TYPE: 'SHIPMENT_INVALID_SERVICE_TYPE',
    INVALID_PICKUP_ADDRESS: 'SHIPMENT_INVALID_PICKUP_ADDRESS',
    INVALID_DELIVERY_ADDRESS: 'SHIPMENT_INVALID_DELIVERY_ADDRESS',
    INVALID_PINCODE: 'SHIPMENT_INVALID_PINCODE',
    UNSUPPORTED_PINCODE: 'SHIPMENT_UNSUPPORTED_PINCODE',
    INVALID_COD_AMOUNT: 'SHIPMENT_INVALID_COD_AMOUNT',
    COD_AMOUNT_REQUIRED: 'SHIPMENT_COD_AMOUNT_REQUIRED',
    COD_NOT_SUPPORTED: 'SHIPMENT_COD_NOT_SUPPORTED',
    INVALID_DECLARED_VALUE: 'SHIPMENT_INVALID_DECLARED_VALUE',
    DECLARED_VALUE_TOO_LOW: 'SHIPMENT_DECLARED_VALUE_TOO_LOW',
    DECLARED_VALUE_TOO_HIGH: 'SHIPMENT_DECLARED_VALUE_TOO_HIGH',
    INVALID_STATUS_TRANSITION: 'SHIPMENT_INVALID_STATUS_TRANSITION',
    INVALID_PACKAGE_COUNT: 'SHIPMENT_INVALID_PACKAGE_COUNT'
  },

  // Financial Operations
  FINANCE: {
    INVALID_AMOUNT: 'FINANCE_INVALID_AMOUNT',
    AMOUNT_TOO_SMALL: 'FINANCE_AMOUNT_TOO_SMALL',
    AMOUNT_TOO_LARGE: 'FINANCE_AMOUNT_TOO_LARGE',
    INSUFFICIENT_BALANCE: 'FINANCE_INSUFFICIENT_BALANCE',
    INVALID_CURRENCY: 'FINANCE_INVALID_CURRENCY',
    INVALID_TRANSACTION_TYPE: 'FINANCE_INVALID_TRANSACTION_TYPE',
    INVALID_PAYMENT_METHOD: 'FINANCE_INVALID_PAYMENT_METHOD',
    DUPLICATE_TRANSACTION: 'FINANCE_DUPLICATE_TRANSACTION',
    TRANSACTION_LIMIT_EXCEEDED: 'FINANCE_TRANSACTION_LIMIT_EXCEEDED',
    INVALID_WALLET_TYPE: 'FINANCE_INVALID_WALLET_TYPE',
    WALLET_LOCKED: 'FINANCE_WALLET_LOCKED',
    INVALID_COMMISSION_RATE: 'FINANCE_INVALID_COMMISSION_RATE',
    INVALID_TAX_RATE: 'FINANCE_INVALID_TAX_RATE'
  },

  // Dispute Management
  DISPUTE: {
    INVALID_DISPUTE_TYPE: 'DISPUTE_INVALID_TYPE',
    INVALID_DISPUTE_STATUS: 'DISPUTE_INVALID_STATUS',
    INVALID_PRIORITY: 'DISPUTE_INVALID_PRIORITY',
    SHIPMENT_NOT_ELIGIBLE: 'DISPUTE_SHIPMENT_NOT_ELIGIBLE',
    DUPLICATE_DISPUTE: 'DISPUTE_DUPLICATE',
    RESOLUTION_REQUIRED: 'DISPUTE_RESOLUTION_REQUIRED',
    INVALID_EVIDENCE: 'DISPUTE_INVALID_EVIDENCE',
    EVIDENCE_TOO_LARGE: 'DISPUTE_EVIDENCE_TOO_LARGE',
    INVALID_WEIGHT_DIFFERENCE: 'DISPUTE_INVALID_WEIGHT_DIFFERENCE',
    TIMEOUT_EXCEEDED: 'DISPUTE_TIMEOUT_EXCEEDED'
  },

  // Support & Tickets
  SUPPORT: {
    INVALID_TICKET_TYPE: 'SUPPORT_INVALID_TICKET_TYPE',
    INVALID_PRIORITY: 'SUPPORT_INVALID_PRIORITY',
    INVALID_STATUS: 'SUPPORT_INVALID_STATUS',
    INVALID_CATEGORY: 'SUPPORT_INVALID_CATEGORY',
    DESCRIPTION_TOO_SHORT: 'SUPPORT_DESCRIPTION_TOO_SHORT',
    DESCRIPTION_TOO_LONG: 'SUPPORT_DESCRIPTION_TOO_LONG',
    INVALID_ATTACHMENT: 'SUPPORT_INVALID_ATTACHMENT',
    ATTACHMENT_TOO_LARGE: 'SUPPORT_ATTACHMENT_TOO_LARGE',
    TOO_MANY_ATTACHMENTS: 'SUPPORT_TOO_MANY_ATTACHMENTS'
  },

  // File Upload & Processing
  FILE: {
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    INVALID_FILE_TYPE: 'FILE_INVALID_TYPE',
    INVALID_FILE_EXTENSION: 'FILE_INVALID_EXTENSION',
    CORRUPTED_FILE: 'FILE_CORRUPTED',
    VIRUS_DETECTED: 'FILE_VIRUS_DETECTED',
    INVALID_CSV_FORMAT: 'FILE_INVALID_CSV_FORMAT',
    INVALID_CSV_HEADERS: 'FILE_INVALID_CSV_HEADERS',
    CSV_ROW_ERROR: 'FILE_CSV_ROW_ERROR',
    TOO_MANY_FILES: 'FILE_TOO_MANY_FILES',
    UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
    PROCESSING_FAILED: 'FILE_PROCESSING_FAILED'
  },

  // Database & Object References
  DATABASE: {
    INVALID_OBJECT_ID: 'DATABASE_INVALID_OBJECT_ID',
    RECORD_NOT_FOUND: 'DATABASE_RECORD_NOT_FOUND',
    DUPLICATE_RECORD: 'DATABASE_DUPLICATE_RECORD',
    FOREIGN_KEY_VIOLATION: 'DATABASE_FOREIGN_KEY_VIOLATION',
    CONSTRAINT_VIOLATION: 'DATABASE_CONSTRAINT_VIOLATION',
    INVALID_QUERY: 'DATABASE_INVALID_QUERY',
    INVALID_SORT_FIELD: 'DATABASE_INVALID_SORT_FIELD',
    INVALID_FILTER: 'DATABASE_INVALID_FILTER'
  },

  // Rate Limiting & Security
  SECURITY: {
    RATE_LIMIT_EXCEEDED: 'SECURITY_RATE_LIMIT_EXCEEDED',
    SUSPICIOUS_ACTIVITY: 'SECURITY_SUSPICIOUS_ACTIVITY',
    IP_BLOCKED: 'SECURITY_IP_BLOCKED',
    INVALID_API_KEY: 'SECURITY_INVALID_API_KEY',
    PERMISSION_DENIED: 'SECURITY_PERMISSION_DENIED',
    RESOURCE_LOCKED: 'SECURITY_RESOURCE_LOCKED',
    SESSION_EXPIRED: 'SECURITY_SESSION_EXPIRED',
    CONCURRENT_REQUEST: 'SECURITY_CONCURRENT_REQUEST'
  }
};

// Error message templates with internationalization support
const ERROR_MESSAGES = {
  en: {
    // Base validation messages
    [BASE_ERROR_CODES.REQUIRED]: 'This field is required',
    [BASE_ERROR_CODES.INVALID_TYPE]: 'Invalid data type provided',
    [BASE_ERROR_CODES.INVALID_FORMAT]: 'Invalid format',
    [BASE_ERROR_CODES.INVALID_LENGTH]: 'Invalid length',
    [BASE_ERROR_CODES.INVALID_RANGE]: 'Value out of valid range',
    [BASE_ERROR_CODES.INVALID_ENUM]: 'Invalid option selected',
    
    [BASE_ERROR_CODES.STRING_TOO_SHORT]: 'Text is too short (minimum {min} characters)',
    [BASE_ERROR_CODES.STRING_TOO_LONG]: 'Text is too long (maximum {max} characters)',
    [BASE_ERROR_CODES.STRING_INVALID_CHARACTERS]: 'Contains invalid characters',
    [BASE_ERROR_CODES.STRING_PATTERN_MISMATCH]: 'Does not match required pattern',
    
    [BASE_ERROR_CODES.NUMBER_TOO_SMALL]: 'Number is too small (minimum {min})',
    [BASE_ERROR_CODES.NUMBER_TOO_LARGE]: 'Number is too large (maximum {max})',
    [BASE_ERROR_CODES.NUMBER_NOT_INTEGER]: 'Must be a whole number',
    [BASE_ERROR_CODES.NUMBER_INVALID_PRECISION]: 'Too many decimal places (maximum {precision})',
    
    // Authentication messages
    [DOMAIN_ERROR_CODES.AUTH.INVALID_EMAIL]: 'Please enter a valid email address',
    [DOMAIN_ERROR_CODES.AUTH.INVALID_PASSWORD]: 'Invalid password format',
    [DOMAIN_ERROR_CODES.AUTH.PASSWORD_TOO_WEAK]: 'Password is too weak',
    [DOMAIN_ERROR_CODES.AUTH.PASSWORD_MISSING_UPPERCASE]: 'Password must contain at least one uppercase letter',
    [DOMAIN_ERROR_CODES.AUTH.PASSWORD_MISSING_LOWERCASE]: 'Password must contain at least one lowercase letter',
    [DOMAIN_ERROR_CODES.AUTH.PASSWORD_MISSING_NUMBER]: 'Password must contain at least one number',
    [DOMAIN_ERROR_CODES.AUTH.PASSWORD_MISSING_SPECIAL]: 'Password must contain at least one special character',
    
    // User management messages
    [DOMAIN_ERROR_CODES.USER.INVALID_PHONE]: 'Please enter a valid phone number',
    [DOMAIN_ERROR_CODES.USER.PHONE_ALREADY_EXISTS]: 'This phone number is already registered',
    [DOMAIN_ERROR_CODES.USER.EMAIL_ALREADY_EXISTS]: 'This email address is already registered',
    
    // Shipment messages
    [DOMAIN_ERROR_CODES.SHIPMENT.INVALID_WEIGHT]: 'Please enter a valid weight',
    [DOMAIN_ERROR_CODES.SHIPMENT.WEIGHT_EXCEEDS_LIMIT]: 'Weight exceeds maximum limit of {limit}kg',
    [DOMAIN_ERROR_CODES.SHIPMENT.INVALID_PINCODE]: 'Please enter a valid 6-digit PIN code',
    [DOMAIN_ERROR_CODES.SHIPMENT.COD_AMOUNT_REQUIRED]: 'COD amount is required when COD is enabled',
    
    // Financial messages
    [DOMAIN_ERROR_CODES.FINANCE.INVALID_AMOUNT]: 'Please enter a valid amount',
    [DOMAIN_ERROR_CODES.FINANCE.AMOUNT_TOO_SMALL]: 'Amount is below minimum limit of ₹{min}',
    [DOMAIN_ERROR_CODES.FINANCE.AMOUNT_TOO_LARGE]: 'Amount exceeds maximum limit of ₹{max}',
    [DOMAIN_ERROR_CODES.FINANCE.INSUFFICIENT_BALANCE]: 'Insufficient wallet balance',
    
    // File upload messages
    [DOMAIN_ERROR_CODES.FILE.FILE_TOO_LARGE]: 'File size exceeds maximum limit of {limit}MB',
    [DOMAIN_ERROR_CODES.FILE.INVALID_FILE_TYPE]: 'File type {type} is not supported',
    [DOMAIN_ERROR_CODES.FILE.VIRUS_DETECTED]: 'Virus detected in uploaded file',
    
    // Security messages
    [DOMAIN_ERROR_CODES.SECURITY.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please try again later',
    [DOMAIN_ERROR_CODES.SECURITY.PERMISSION_DENIED]: 'You do not have permission to perform this action'
  },
  
  hi: {
    // Hindi translations for common validation messages
    [BASE_ERROR_CODES.REQUIRED]: 'यह फ़ील्ड आवश्यक है',
    [BASE_ERROR_CODES.INVALID_FORMAT]: 'अमान्य प्रारूप',
    [BASE_ERROR_CODES.INVALID_TYPE]: 'अमान्य डेटा प्रकार प्रदान किया गया',
    [BASE_ERROR_CODES.INVALID_LENGTH]: 'अमान्य लंबाई',
    [BASE_ERROR_CODES.INVALID_RANGE]: 'मान वैध सीमा से बाहर है',
    [BASE_ERROR_CODES.STRING_TOO_SHORT]: 'टेक्स्ट बहुत छोटा है (न्यूनतम {min} वर्ण)',
    [BASE_ERROR_CODES.STRING_TOO_LONG]: 'टेक्स्ट बहुत लंबा है (अधिकतम {max} वर्ण)',
    [BASE_ERROR_CODES.NUMBER_TOO_SMALL]: 'संख्या बहुत छोटी है (न्यूनतम {min})',
    [BASE_ERROR_CODES.NUMBER_TOO_LARGE]: 'संख्या बहुत बड़ी है (अधिकतम {max})',
    [DOMAIN_ERROR_CODES.AUTH.INVALID_EMAIL]: 'कृपया एक वैध ईमेल पता दर्ज करें',
    [DOMAIN_ERROR_CODES.AUTH.INVALID_PASSWORD]: 'अमान्य पासवर्ड प्रारूप',
    [DOMAIN_ERROR_CODES.AUTH.PASSWORD_TOO_WEAK]: 'पासवर्ड बहुत कमजोर है',
    [DOMAIN_ERROR_CODES.USER.INVALID_PHONE]: 'कृपया एक वैध फोन नंबर दर्ज करें',
    [DOMAIN_ERROR_CODES.USER.PHONE_ALREADY_EXISTS]: 'यह फोन नंबर पहले से पंजीकृत है',
    [DOMAIN_ERROR_CODES.USER.EMAIL_ALREADY_EXISTS]: 'यह ईमेल पता पहले से पंजीकृत है',
    [DOMAIN_ERROR_CODES.SHIPMENT.INVALID_PINCODE]: 'कृपया एक वैध 6-अंकीय पिन कोड दर्ज करें',
    [DOMAIN_ERROR_CODES.SHIPMENT.INVALID_WEIGHT]: 'कृपया एक वैध वजन दर्ज करें',
    [DOMAIN_ERROR_CODES.SHIPMENT.COD_AMOUNT_REQUIRED]: 'COD सक्षम होने पर COD राशि आवश्यक है',
    [DOMAIN_ERROR_CODES.FINANCE.INSUFFICIENT_BALANCE]: 'वॉलेट में पर्याप्त बैलेंस नहीं है',
    [DOMAIN_ERROR_CODES.FINANCE.INVALID_AMOUNT]: 'कृपया एक वैध राशि दर्ज करें',
    [DOMAIN_ERROR_CODES.FILE.FILE_TOO_LARGE]: 'फाइल का साइज़ अधिकतम सीमा {limit}MB से अधिक है',
    [DOMAIN_ERROR_CODES.FILE.INVALID_FILE_TYPE]: 'फाइल प्रकार {type} समर्थित नहीं है',
    [DOMAIN_ERROR_CODES.SECURITY.RATE_LIMIT_EXCEEDED]: 'बहुत सारे अनुरोध। कृपया बाद में पुनः प्रयास करें',
    [DOMAIN_ERROR_CODES.SECURITY.PERMISSION_DENIED]: 'आपको यह कार्य करने की अनुमति नहीं है'
  },
  
  // Gujarati translations for regional support
  gu: {
    [BASE_ERROR_CODES.REQUIRED]: 'આ ફીલ્ડ જરૂરી છે',
    [BASE_ERROR_CODES.INVALID_FORMAT]: 'અમાન્ય ફોર્મેટ',
    [DOMAIN_ERROR_CODES.AUTH.INVALID_EMAIL]: 'કૃપા કરીને માન્ય ઈમેઇલ સરનામું દાખલ કરો',
    [DOMAIN_ERROR_CODES.USER.INVALID_PHONE]: 'કૃપા કરીને માન્ય ફોન નંબર દાખલ કરો',
    [DOMAIN_ERROR_CODES.SHIPMENT.INVALID_PINCODE]: 'કૃપા કરીને માન્ય 6-અંકનો પિન કોડ દાખલ કરો',
    [DOMAIN_ERROR_CODES.FINANCE.INSUFFICIENT_BALANCE]: 'વોલેટમાં પૂરતું બેલેન્સ નથી',
    [DOMAIN_ERROR_CODES.SECURITY.RATE_LIMIT_EXCEEDED]: 'ઘણી બધી વિનંતીઓ. કૃપા કરીને પછીથી પ્રયાસ કરો'
  }
};

// Error severity levels
const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Error category mapping for monitoring and analytics
const ERROR_CATEGORIES = {
  VALIDATION: 'validation',
  BUSINESS_RULE: 'business_rule',
  SECURITY: 'security',
  SYSTEM: 'system',
  USER_INPUT: 'user_input'
};

// HTTP status code mapping for validation errors
const ERROR_HTTP_STATUS = {
  [BASE_ERROR_CODES.REQUIRED]: 400,
  [BASE_ERROR_CODES.INVALID_TYPE]: 400,
  [BASE_ERROR_CODES.INVALID_FORMAT]: 400,
  [DOMAIN_ERROR_CODES.AUTH.INVALID_CREDENTIALS]: 401,
  [DOMAIN_ERROR_CODES.AUTH.TOKEN_EXPIRED]: 401,
  [DOMAIN_ERROR_CODES.SECURITY.PERMISSION_DENIED]: 403,
  [DOMAIN_ERROR_CODES.SECURITY.RATE_LIMIT_EXCEEDED]: 429,
  [DOMAIN_ERROR_CODES.DATABASE.RECORD_NOT_FOUND]: 404,
  [DOMAIN_ERROR_CODES.FILE.FILE_TOO_LARGE]: 413,
  [DOMAIN_ERROR_CODES.FINANCE.INSUFFICIENT_BALANCE]: 402
};

/**
 * Get error message with template variable substitution and fallback support
 * @param {string} errorCode - The error code
 * @param {string} language - Language code (default: 'en')
 * @param {object} variables - Template variables for substitution
 * @returns {string} Formatted error message
 */
const getErrorMessage = (errorCode, language = 'en', variables = {}) => {
  const messages = ERROR_MESSAGES[language] || ERROR_MESSAGES.en;
  let message = messages[errorCode];
  
  // Fallback to English if translation not found
  if (!message && language !== 'en') {
    message = ERROR_MESSAGES.en[errorCode];
  }
  
  // Final fallback to generic error message
  if (!message) {
    message = `Validation error: ${errorCode}`;
  }
  
  // Replace template variables
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{${key}}`, 'g');
    message = message.replace(regex, variables[key]);
  });
  
  return message;
};

/**
 * Get available languages for error messages
 * @returns {string[]} Array of language codes
 */
const getAvailableLanguages = () => {
  return Object.keys(ERROR_MESSAGES);
};

/**
 * Get HTTP status code for error
 * @param {string} errorCode - The error code
 * @returns {number} HTTP status code
 */
const getErrorHttpStatus = (errorCode) => {
  return ERROR_HTTP_STATUS[errorCode] || 400;
};

/**
 * Create standardized validation error object
 * @param {string} errorCode - The error code
 * @param {string} field - Field name where error occurred
 * @param {object} options - Additional options
 * @returns {object} Formatted error object
 */
const createValidationError = (errorCode, field, options = {}) => {
  const {
    language = 'en',
    variables = {},
    severity = ERROR_SEVERITY.MEDIUM,
    category = ERROR_CATEGORIES.VALIDATION,
    value = undefined
  } = options;
  
  const localizedMessage = getErrorMessage(errorCode, language, variables);
  return {
    code: errorCode,
    field: field,
    message: `${field}: ${localizedMessage}`,
    severity: severity,
    category: category,
    httpStatus: getErrorHttpStatus(errorCode),
    ...(value !== undefined && { value: value }),
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  BASE_ERROR_CODES,
  DOMAIN_ERROR_CODES,
  ERROR_MESSAGES,
  ERROR_SEVERITY,
  ERROR_CATEGORIES,
  ERROR_HTTP_STATUS,
  getErrorMessage,
  getAvailableLanguages,
  getErrorHttpStatus,
  createValidationError
};
