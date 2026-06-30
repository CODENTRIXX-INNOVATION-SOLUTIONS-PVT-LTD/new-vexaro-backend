/**
 * Validation Patterns and Regular Expressions
 * Comprehensive regex patterns for common validation tasks.
 * Supports Indian-specific formats while maintaining international compatibility.
 * 
 * Task 1.3: Set up validation constants, patterns, and error codes
 * Requirements: R7.1, R7.2
 * - Regex patterns for common validation tasks (phone, email, PIN codes, etc.)
 * - Pattern collections support enterprise validation scenarios
 */

// Basic format patterns
const BASIC_PATTERNS = {
  // Text patterns
  ALPHABETIC: /^[a-zA-Z]+$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  ALPHANUMERIC_SPACES: /^[a-zA-Z0-9\s]+$/,
  NUMERIC: /^\d+$/,
  DECIMAL: /^\d+(\.\d+)?$/,
  
  // Special characters
  NO_SPECIAL_CHARS: /^[a-zA-Z0-9\s]+$/,
  SAFE_TEXT: /^[a-zA-Z0-9\s\.,\-_()]+$/, // Safe for display
  
  // Whitespace handling
  NO_LEADING_TRAILING_SPACES: /^\S.*\S$|^\S$/, // No leading/trailing spaces
  NO_MULTIPLE_SPACES: /^(?!.*\s{2,}).*$/, // No multiple consecutive spaces
  
  // Case patterns
  UPPERCASE: /^[A-Z\s]+$/,
  LOWERCASE: /^[a-z\s]+$/,
  TITLE_CASE: /^[A-Z][a-z]*(\s[A-Z][a-z]*)*$/,
  
  // Security patterns
  NO_HTML_TAGS: /^(?!.*<[^>]+>).*$/, // No HTML tags
  NO_SCRIPT_TAGS: /^(?!.*<script).*$/i, // No script tags
  NO_SQL_INJECTION: /^(?!.*(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript|vbscript|onload|onerror|onclick)).*$/i
};

// Contact information patterns
const CONTACT_PATTERNS = {
  // Email patterns
  EMAIL_BASIC: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  EMAIL_RFC5322: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  EMAIL_DOMAIN_WHITELIST: /^[a-zA-Z0-9._%+-]+@(gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|rediffmail\.com|[a-zA-Z0-9.-]+\.(com|in|co\.in|org|net|edu))$/i,
  
  // Indian phone number patterns
  PHONE_INDIAN_MOBILE: /^[6-9]\d{9}$/, // 10-digit Indian mobile
  PHONE_INDIAN_WITH_CODE: /^(\+91|91)?[6-9]\d{9}$/, // With country code
  PHONE_INDIAN_FORMATTED: /^(\+91[\-\s]?)?[6-9]\d{4}[\-\s]?\d{5}$/, // Formatted
  PHONE_LANDLINE_INDIAN: /^0[1-9]\d{2,4}\d{6,8}$/, // Indian landline
  
  // International phone patterns
  PHONE_INTERNATIONAL: /^\+[1-9]\d{1,14}$/, // E.164 format
  PHONE_INTERNATIONAL_FORMATTED: /^\+[1-9][\d\s\-\(\)]{7,14}$/, // With formatting
  
  // Website and URL patterns
  URL_BASIC: /^https?:\/\/[^\s]+$/,
  URL_STRICT: /^https?:\/\/(?:[-\w.])+(?:\:[0-9]+)?(?:\/[^?\s]*)?(?:\?[^#\s]*)?(?:#[^\s]*)?$/,
  DOMAIN: /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/
};

// Indian-specific patterns
const INDIAN_PATTERNS = {
  // PIN code patterns
  PINCODE: /^[1-9]\d{5}$/, // 6-digit Indian PIN code
  PINCODE_FORMATTED: /^[1-9]\d{2}[\s\-]?\d{3}$/, // With formatting
  
  // Government ID patterns
  PAN_CARD: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  AADHAAR: /^[2-9]{1}[0-9]{3}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}$/,
  GST_NUMBER: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  
  // Vehicle patterns
  VEHICLE_NUMBER: /^[A-Z]{2}[\s\-]?[0-9]{1,2}[\s\-]?[A-Z]{1,2}[\s\-]?[0-9]{1,4}$/,
  
  // Banking patterns
  IFSC_CODE: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  ACCOUNT_NUMBER: /^[0-9]{9,18}$/,
  
  // Indian names (supporting various scripts)
  INDIAN_NAME: /^[a-zA-Z\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\s\.']+$/
};

// Address patterns
const ADDRESS_PATTERNS = {
  // Indian address components
  HOUSE_NUMBER: /^[0-9A-Za-z\-\/\s]{1,10}$/,
  STREET_NAME: /^[a-zA-Z0-9\s\.,\-\(\)\/]{2,100}$/,
  AREA_NAME: /^[a-zA-Z0-9\s\.,\-\(\)]{2,50}$/,
  
  // City and state names
  CITY_NAME: /^[a-zA-Z\s\.']{2,50}$/,
  STATE_NAME: /^[a-zA-Z\s\.']{2,50}$/,
  
  // Landmark patterns
  LANDMARK: /^[a-zA-Z0-9\s\.,\-\(\)\/]{1,100}$/,
  
  // Address line patterns
  ADDRESS_LINE: /^[a-zA-Z0-9\s\.,\-\(\)\/\#]{10,200}$/,
  FULL_ADDRESS: /^[a-zA-Z0-9\s\.,\-\(\)\/\#\n]{20,500}$/
};

// Financial patterns
const FINANCIAL_PATTERNS = {
  // Amount patterns
  MONEY_AMOUNT: /^\d+(\.\d{1,2})?$/, // Up to 2 decimal places
  CURRENCY_CODE: /^[A-Z]{3}$/, // ISO currency codes
  
  // Indian currency
  RUPEE_AMOUNT: /^₹?\s?\d{1,3}(,\d{2,3})*(\.\d{1,2})?$/, // Indian rupee format
  PAISA_AMOUNT: /^\d+$/, // Amount in paisa (no decimals)
  
  // Commission and rates
  PERCENTAGE: /^\d{1,2}(\.\d{1,2})?$/, // 0-99.99%
  RATE: /^\d{1,3}(\.\d{1,4})?$/, // Rates with up to 4 decimal places
  
  // Transaction patterns
  TRANSACTION_ID: /^TXN[A-Z0-9]{10,20}$/,
  REFERENCE_NUMBER: /^[A-Z0-9]{6,25}$/,
  
  // Payment method patterns
  UPI_ID: /^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-_]+$/,
  CARD_NUMBER: /^\d{13,19}$/, // Credit/debit card numbers
  CARD_CVV: /^\d{3,4}$/, // CVV codes
  CARD_EXPIRY: /^(0[1-9]|1[0-2])\/([0-9]{2})$/ // MM/YY format
};

// Business and operational patterns
const BUSINESS_PATTERNS = {
  // Shipment patterns
  TRACKING_NUMBER: /^[A-Z0-9]{8,30}$/,
  ORDER_ID: /^ORD[A-Z0-9]{8,20}$/,
  SHIPMENT_ID: /^SHP[A-Z0-9]{8,20}$/,
  AWB_NUMBER: /^[A-Z0-9]{10,15}$/,
  
  // Weight and dimensions
  WEIGHT_KG: /^\d{1,3}(\.\d{1,3})?$/, // Weight in kg
  DIMENSION_CM: /^\d{1,3}(\.\d{1,2})?$/, // Dimensions in cm
  
  // Service codes
  SERVICE_TYPE: /^(STANDARD|EXPRESS|SAME_DAY|OVERNIGHT)$/,
  DELIVERY_TYPE: /^(DOOR|PICKUP|LOCKER)$/,
  
  // Status patterns
  STATUS_CODE: /^[A-Z_]{3,20}$/,
  PRIORITY_LEVEL: /^(LOW|MEDIUM|HIGH|CRITICAL)$/,
  
  // User and role patterns
  USER_TYPE: /^(ADMIN|DISTRIBUTOR|MERCHANT|WAREHOUSE|CUSTOMER)$/,
  ROLE_NAME: /^[A-Z_]{3,30}$/,
  
  // Company and business
  COMPANY_CODE: /^[A-Z0-9]{3,10}$/,
  BRANCH_CODE: /^[A-Z0-9]{3,8}$/,
  WAREHOUSE_CODE: /^WH[A-Z0-9]{3,8}$/
};

// Security and validation patterns
const SECURITY_PATTERNS = {
  // Password patterns
  PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  PASSWORD_MEDIUM: /^(?=.*[a-zA-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{6,}$/,
  
  // Token patterns
  JWT_TOKEN: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
  API_KEY: /^[A-Za-z0-9]{32,64}$/,
  SESSION_ID: /^[A-Za-z0-9]{20,40}$/,
  
  // OTP and verification codes
  OTP_6_DIGIT: /^[0-9]{6}$/,
  OTP_4_DIGIT: /^[0-9]{4}$/,
  VERIFICATION_CODE: /^[A-Z0-9]{4,8}$/,
  
  // IP address patterns
  IPV4: /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/,
  IPV6: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,
  
  // File security patterns
  SAFE_FILENAME: /^[a-zA-Z0-9\-_.]{1,255}$/,
  IMAGE_FILE: /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i,
  DOCUMENT_FILE: /\.(pdf|doc|docx|txt|rtf|odt)$/i,
  EXECUTABLE_FILE: /\.(exe|bat|com|cmd|scr|pif|msi|dll|jar)$/i
};

// Date and time patterns
const DATE_TIME_PATTERNS = {
  // Date formats
  DATE_ISO: /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
  DATE_INDIAN: /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
  DATE_US: /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
  
  // Time formats
  TIME_24H: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM
  TIME_12H: /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)$/, // HH:MM AM/PM
  
  // DateTime formats
  DATETIME_ISO: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/, // ISO 8601
  TIMESTAMP: /^\d{10}$/, // Unix timestamp (10 digits)
  TIMESTAMP_MS: /^\d{13}$/, // Unix timestamp milliseconds (13 digits)
  
  // Relative time
  DURATION: /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/, // ISO 8601 duration
  
  // Business hours
  BUSINESS_HOURS: /^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$/
};

// File and media patterns
const FILE_PATTERNS = {
  // File extensions
  IMAGE_EXT: /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)$/i,
  VIDEO_EXT: /\.(mp4|avi|mov|wmv|flv|webm|mkv)$/i,
  AUDIO_EXT: /\.(mp3|wav|ogg|aac|flac|m4a)$/i,
  DOCUMENT_EXT: /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|odt|ods|odp)$/i,
  ARCHIVE_EXT: /\.(zip|rar|7z|tar|gz|bz2)$/i,
  
  // MIME types
  IMAGE_MIME: /^image\/(jpeg|png|gif|webp|bmp|svg\+xml)$/,
  VIDEO_MIME: /^video\/(mp4|avi|quicktime|x-msvideo|webm|x-matroska)$/,
  AUDIO_MIME: /^audio\/(mpeg|wav|ogg|aac|x-flac|mp4)$/,
  DOCUMENT_MIME: /^application\/(pdf|msword|vnd\.(ms-|openxmlformats-)).*$/,
  
  // CSV specific patterns
  CSV_HEADER: /^[a-zA-Z][a-zA-Z0-9_\s]*$/,
  CSV_DELIMITER: /^[,;\t|]$/,
  CSV_ROW: /^([^,"\n\r]*|"([^"]|"")*")(,([^,"\n\r]*|"([^"]|"")*"))*$/
};

// Compiled pattern collections for easy access
const PATTERN_COLLECTIONS = {
  BASIC: BASIC_PATTERNS,
  CONTACT: CONTACT_PATTERNS,
  INDIAN: INDIAN_PATTERNS,
  ADDRESS: ADDRESS_PATTERNS,
  FINANCIAL: FINANCIAL_PATTERNS,
  BUSINESS: BUSINESS_PATTERNS,
  SECURITY: SECURITY_PATTERNS,
  DATETIME: DATE_TIME_PATTERNS,
  FILE: FILE_PATTERNS
};

/**
 * Get pattern by category and name
 * @param {string} category - Pattern category
 * @param {string} name - Pattern name
 * @returns {RegExp|null} Regular expression or null if not found
 */
const getPattern = (category, name) => {
  const categoryPatterns = PATTERN_COLLECTIONS[category.toUpperCase()];
  return categoryPatterns ? categoryPatterns[name.toUpperCase()] : null;
};

/**
 * Test value against pattern with enhanced error reporting
 * @param {string} value - Value to test
 * @param {RegExp} pattern - Regular expression pattern
 * @param {string} fieldName - Name of the field for error context
 * @returns {object} Test result with enhanced metadata
 */
const testPattern = (value, pattern, fieldName = 'field') => {
  if (!(pattern instanceof RegExp)) {
    return { 
      isValid: false, 
      error: `Invalid pattern provided for ${fieldName}`,
      fieldName: fieldName
    };
  }
  
  if (typeof value !== 'string') {
    return {
      isValid: false,
      error: `${fieldName} must be a string for pattern validation`,
      fieldName: fieldName,
      actualType: typeof value
    };
  }
  
  const matches = pattern.exec(value);
  return {
    isValid: pattern.test(value),
    matches: matches,
    groups: matches ? matches.groups : null,
    fieldName: fieldName,
    patternSource: pattern.source
  };
};

/**
 * Validate value against multiple patterns with detailed results
 * @param {string} value - Value to validate
 * @param {RegExp[]} patterns - Array of patterns to test
 * @param {string} fieldName - Field name for error context
 * @returns {object} Validation result with pattern match details
 */
const testAnyPattern = (value, patterns, fieldName = 'field') => {
  const results = [];
  
  for (let i = 0; i < patterns.length; i++) {
    const result = testPattern(value, patterns[i], fieldName);
    results.push({
      patternIndex: i,
      pattern: patterns[i].source,
      ...result
    });
    
    if (result.isValid) {
      return {
        isValid: true,
        matchedPattern: patterns[i],
        matchedIndex: i,
        ...result,
        allResults: results
      };
    }
  }
  
  return { 
    isValid: false, 
    error: `${fieldName} does not match any of the ${patterns.length} expected patterns`,
    fieldName: fieldName,
    allResults: results
  };
};

/**
 * Validate value against multiple patterns (all must pass)
 * @param {string} value - Value to validate
 * @param {RegExp[]} patterns - Array of patterns (all must match)
 * @param {string} fieldName - Field name for error context
 * @returns {object} Validation result
 */
const testAllPatterns = (value, patterns, fieldName = 'field') => {
  const results = [];
  
  for (let i = 0; i < patterns.length; i++) {
    const result = testPattern(value, patterns[i], fieldName);
    results.push({
      patternIndex: i,
      pattern: patterns[i].source,
      ...result
    });
    
    if (!result.isValid) {
      return {
        isValid: false,
        failedPattern: patterns[i],
        failedIndex: i,
        error: `${fieldName} failed pattern ${i + 1} of ${patterns.length}: ${result.error}`,
        fieldName: fieldName,
        allResults: results
      };
    }
  }
  
  return { 
    isValid: true,
    fieldName: fieldName,
    allResults: results
  };
};

/**
 * Extract and clean phone number with enhanced validation
 * @param {string} phone - Raw phone number
 * @param {object} options - Validation options
 * @returns {object} Cleaned phone number with detailed validation info
 */
const cleanPhoneNumber = (phone, options = {}) => {
  const { allowInternational = true, preferredCountry = 'IN' } = options;
  
  // Remove all formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  
  // Detect format and validate
  let format = 'unknown';
  let countryCode = null;
  let number = cleaned;
  let isValid = false;
  let normalizedNumber = null;
  
  // Check Indian mobile number patterns
  if (CONTACT_PATTERNS.PHONE_INDIAN_MOBILE.test(cleaned)) {
    format = 'indian_mobile';
    countryCode = '91';
    number = cleaned;
    isValid = true;
    normalizedNumber = `+91${cleaned}`;
  } else if (cleaned.startsWith('91') && cleaned.length === 12 && 
             CONTACT_PATTERNS.PHONE_INDIAN_MOBILE.test(cleaned.slice(2))) {
    format = 'indian_mobile';
    countryCode = '91';
    number = cleaned.slice(2);
    isValid = true;
    normalizedNumber = `+91${number}`;
  } else if (allowInternational && cleaned.length > 7) {
    // Try to match international format - must not start with 0 and be valid E.164
    if (CONTACT_PATTERNS.PHONE_INTERNATIONAL.test(`+${cleaned}`) && !cleaned.startsWith('0')) {
      for (let i = 1; i <= 3; i++) {
        const code = cleaned.slice(0, i);
        const rest = cleaned.slice(i);
        if (rest.length >= 7 && rest.length <= 14 && !rest.startsWith('0')) {
          format = 'international';
          countryCode = code;
          number = rest;
          isValid = true;
          normalizedNumber = `+${cleaned}`;
          break;
        }
      }
    }
  }
  
  return {
    original: phone,
    cleaned: cleaned,
    number: number,
    formatted: number,
    countryCode: countryCode,
    format: format,
    isValid: isValid,
    normalized: normalizedNumber,
    errors: isValid ? [] : ['Invalid phone number format'],
    metadata: {
      length: cleaned.length,
      hasCountryCode: countryCode !== null,
      preferredCountry: preferredCountry
    }
  };
};

/**
 * Validate and format email address with enhanced checks
 * @param {string} email - Email address to validate
 * @param {object} options - Validation options
 * @returns {object} Validation result with formatted email and metadata
 */
const validateEmail = (email, options = {}) => {
  const { allowSubaddressing = true, maxLocalLength = 64, maxDomainLength = 253 } = options;
  
  const trimmed = email.trim().toLowerCase();
  const errors = [];
  
  // Basic format check
  if (!CONTACT_PATTERNS.EMAIL_BASIC.test(trimmed)) {
    errors.push('Invalid email format');
    return { 
      isValid: false, 
      errors: errors,
      original: email 
    };
  }
  
  // RFC5322 compliance check
  if (!CONTACT_PATTERNS.EMAIL_RFC5322.test(trimmed)) {
    errors.push('Email does not meet RFC5322 standards');
  }
  
  // Extract and validate parts
  const [localPart, domain] = trimmed.split('@');
  
  // Check length limits
  if (localPart.length > maxLocalLength) {
    errors.push(`Local part exceeds maximum length of ${maxLocalLength}`);
  }
  
  if (domain.length > maxDomainLength) {
    errors.push(`Domain exceeds maximum length of ${maxDomainLength}`);
  }
  
  // Check for subaddressing (+ symbol)
  const hasSubaddressing = localPart.includes('+');
  if (hasSubaddressing && !allowSubaddressing) {
    errors.push('Subaddressing (+ symbol) is not allowed');
  }
  
  // Extract base email (remove subaddressing)
  const baseLocalPart = hasSubaddressing ? localPart.split('+')[0] : localPart;
  const baseEmail = `${baseLocalPart}@${domain}`;
  
  return {
    isValid: errors.length === 0,
    errors: errors,
    original: email,
    formatted: trimmed,
    baseEmail: baseEmail,
    localPart: localPart,
    baseLocalPart: baseLocalPart,
    domain: domain,
    hasSubaddressing: hasSubaddressing,
    metadata: {
      localLength: localPart.length,
      domainLength: domain.length,
      totalLength: trimmed.length
    }
  };
};

/**
 * Validate Indian PIN code with enhanced checks
 * @param {string} pincode - PIN code to validate
 * @returns {object} Validation result with metadata
 */
const validateIndianPincode = (pincode) => {
  const cleaned = pincode.replace(/[\s\-]/g, '');
  const errors = [];
  
  if (!INDIAN_PATTERNS.PINCODE.test(cleaned)) {
    errors.push('Invalid PIN code format. Must be 6 digits starting with 1-9');
  }
  
  // Additional PIN code validations
  const firstDigit = parseInt(cleaned.charAt(0));
  let region = 'Unknown';
  
  if (firstDigit >= 1 && firstDigit <= 8) {
    const regions = {
      1: 'North (Delhi, Punjab, Haryana, Himachal Pradesh, J&K, Ladakh)',
      2: 'North (Uttar Pradesh, Uttarakhand)',
      3: 'West (Rajasthan, Gujarat, Madhya Pradesh, Chhattisgarh)',
      4: 'West (Maharashtra, Goa, Dadra & Nagar Haveli)',
      5: 'South (Andhra Pradesh, Karnataka, Telangana)',
      6: 'South (Kerala, Tamil Nadu, Puducherry, Lakshadweep)',
      7: 'East (West Bengal, Odisha, Jharkhand)',
      8: 'East (Bihar, Assam, Northeast states, A&N Islands)'
    };
    region = regions[firstDigit];
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors,
    original: pincode,
    cleaned: cleaned,
    formatted: cleaned,
    region: region,
    firstDigit: firstDigit,
    metadata: {
      length: cleaned.length,
      isValidFormat: INDIAN_PATTERNS.PINCODE.test(cleaned)
    }
  };
};

module.exports = {
  // Pattern collections
  BASIC_PATTERNS,
  CONTACT_PATTERNS,
  INDIAN_PATTERNS,
  ADDRESS_PATTERNS,
  FINANCIAL_PATTERNS,
  BUSINESS_PATTERNS,
  SECURITY_PATTERNS,
  DATE_TIME_PATTERNS,
  FILE_PATTERNS,
  PATTERN_COLLECTIONS,
  
  // Utility functions
  getPattern,
  testPattern,
  testAnyPattern,
  testAllPatterns,
  cleanPhoneNumber,
  validateEmail,
  validateIndianPincode
};
