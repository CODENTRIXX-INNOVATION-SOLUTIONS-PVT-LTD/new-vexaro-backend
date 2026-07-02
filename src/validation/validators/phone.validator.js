'use strict';

/**
 * Phone Number Validator Module
 * 
 * Provides comprehensive phone number validation supporting Indian mobile 
 * numbers and international formats as specified in R3.1.
 * 
 * Features:
 * - Indian mobile number validation (10 digits starting with 6-9)
 * - International E.164 format support with country code validation
 * - Phone number normalization and formatting functions
 * - Comprehensive error reporting with specific error codes
 * 
 * @module PhoneValidator
 */

// ─── Phone Number Patterns ─────────────────────────────────────────────────────

/**
 * Indian mobile number pattern
 * Matches 10-digit numbers starting with 6, 7, 8, or 9
 */
const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;

/**
 * Indian mobile with country code patterns
 * Supports +91, 91, and 0091 prefixes
 */
const INDIAN_WITH_CODE_PATTERNS = {
  plus91: /^\+91[6-9]\d{9}$/,
  code91: /^91[6-9]\d{9}$/,
  zero91: /^0091[6-9]\d{9}$/
};

/**
 * International E.164 format pattern
 * Country code (1-4 digits) followed by national number (up to 15 digits total)
 */
const INTERNATIONAL_E164_PATTERN = /^\+[1-9]\d{0,3}\d{1,14}$/;

/**
 * Common phone number separators and formatting characters
 */
const PHONE_SEPARATORS = /[\s\-\(\)\+]/g;

/**
 * Country code definitions for validation
 */
const COUNTRY_CODES = {
  // Major country codes for international validation
  1: { country: 'US/Canada', minLength: 10, maxLength: 10 },
  7: { country: 'Russia/Kazakhstan', minLength: 11, maxLength: 11 },
  20: { country: 'Egypt', minLength: 11, maxLength: 11 },
  27: { country: 'South Africa', minLength: 10, maxLength: 10 },
  30: { country: 'Greece', minLength: 11, maxLength: 11 },
  31: { country: 'Netherlands', minLength: 10, maxLength: 10 },
  32: { country: 'Belgium', minLength: 9, maxLength: 9 },
  33: { country: 'France', minLength: 10, maxLength: 10 },
  34: { country: 'Spain', minLength: 9, maxLength: 9 },
  36: { country: 'Hungary', minLength: 9, maxLength: 9 },
  39: { country: 'Italy', minLength: 10, maxLength: 11 },
  40: { country: 'Romania', minLength: 9, maxLength: 9 },
  41: { country: 'Switzerland', minLength: 9, maxLength: 9 },
  43: { country: 'Austria', minLength: 10, maxLength: 13 },
  44: { country: 'UK', minLength: 10, maxLength: 10 },
  45: { country: 'Denmark', minLength: 8, maxLength: 8 },
  46: { country: 'Sweden', minLength: 9, maxLength: 9 },
  47: { country: 'Norway', minLength: 8, maxLength: 8 },
  48: { country: 'Poland', minLength: 9, maxLength: 9 },
  49: { country: 'Germany', minLength: 11, maxLength: 12 },
  51: { country: 'Peru', minLength: 9, maxLength: 9 },
  52: { country: 'Mexico', minLength: 10, maxLength: 12 },
  53: { country: 'Cuba', minLength: 8, maxLength: 8 },
  54: { country: 'Argentina', minLength: 10, maxLength: 11 },
  55: { country: 'Brazil', minLength: 10, maxLength: 11 },
  56: { country: 'Chile', minLength: 9, maxLength: 9 },
  57: { country: 'Colombia', minLength: 10, maxLength: 10 },
  58: { country: 'Venezuela', minLength: 10, maxLength: 10 },
  60: { country: 'Malaysia', minLength: 9, maxLength: 10 },
  61: { country: 'Australia', minLength: 9, maxLength: 9 },
  62: { country: 'Indonesia', minLength: 9, maxLength: 13 },
  63: { country: 'Philippines', minLength: 10, maxLength: 10 },
  64: { country: 'New Zealand', minLength: 9, maxLength: 10 },
  65: { country: 'Singapore', minLength: 8, maxLength: 8 },
  66: { country: 'Thailand', minLength: 9, maxLength: 9 },
  81: { country: 'Japan', minLength: 10, maxLength: 11 },
  82: { country: 'South Korea', minLength: 10, maxLength: 11 },
  84: { country: 'Vietnam', minLength: 9, maxLength: 10 },
  86: { country: 'China', minLength: 11, maxLength: 11 },
  90: { country: 'Turkey', minLength: 10, maxLength: 10 },
  91: { country: 'India', minLength: 10, maxLength: 10 },
  92: { country: 'Pakistan', minLength: 10, maxLength: 10 },
  93: { country: 'Afghanistan', minLength: 9, maxLength: 9 },
  94: { country: 'Sri Lanka', minLength: 9, maxLength: 9 },
  95: { country: 'Myanmar', minLength: 8, maxLength: 10 },
  98: { country: 'Iran', minLength: 10, maxLength: 10 },
  212: { country: 'Morocco', minLength: 9, maxLength: 9 },
  213: { country: 'Algeria', minLength: 9, maxLength: 9 },
  216: { country: 'Tunisia', minLength: 8, maxLength: 8 },
  218: { country: 'Libya', minLength: 9, maxLength: 9 },
  220: { country: 'Gambia', minLength: 7, maxLength: 7 },
  221: { country: 'Senegal', minLength: 9, maxLength: 9 },
  222: { country: 'Mauritania', minLength: 8, maxLength: 8 },
  223: { country: 'Mali', minLength: 8, maxLength: 8 },
  224: { country: 'Guinea', minLength: 9, maxLength: 9 },
  225: { country: 'Ivory Coast', minLength: 10, maxLength: 10 },
  226: { country: 'Burkina Faso', minLength: 8, maxLength: 8 },
  227: { country: 'Niger', minLength: 8, maxLength: 8 },
  228: { country: 'Togo', minLength: 8, maxLength: 8 },
  229: { country: 'Benin', minLength: 8, maxLength: 8 },
  230: { country: 'Mauritius', minLength: 7, maxLength: 8 },
  231: { country: 'Liberia', minLength: 7, maxLength: 8 },
  232: { country: 'Sierra Leone', minLength: 8, maxLength: 8 },
  233: { country: 'Ghana', minLength: 9, maxLength: 9 },
  234: { country: 'Nigeria', minLength: 10, maxLength: 11 },
  235: { country: 'Chad', minLength: 8, maxLength: 8 },
  236: { country: 'Central African Republic', minLength: 8, maxLength: 8 },
  237: { country: 'Cameroon', minLength: 9, maxLength: 9 },
  238: { country: 'Cape Verde', minLength: 7, maxLength: 7 },
  239: { country: 'Sao Tome and Principe', minLength: 7, maxLength: 7 },
  240: { country: 'Equatorial Guinea', minLength: 9, maxLength: 9 },
  241: { country: 'Gabon', minLength: 7, maxLength: 8 },
  242: { country: 'Republic of the Congo', minLength: 9, maxLength: 9 },
  243: { country: 'Democratic Republic of the Congo', minLength: 9, maxLength: 9 },
  244: { country: 'Angola', minLength: 9, maxLength: 9 },
  245: { country: 'Guinea-Bissau', minLength: 7, maxLength: 7 },
  246: { country: 'British Indian Ocean Territory', minLength: 7, maxLength: 7 },
  248: { country: 'Seychelles', minLength: 7, maxLength: 7 },
  249: { country: 'Sudan', minLength: 9, maxLength: 9 },
  250: { country: 'Rwanda', minLength: 9, maxLength: 9 }
};
// ─── Phone Number Error Codes ──────────────────────────────────────────────────

/**
 * Phone validation error codes for consistent error reporting
 */
const PHONE_ERROR_CODES = {
  INVALID_FORMAT: 'INVALID_PHONE_FORMAT',
  INVALID_INDIAN_MOBILE: 'INVALID_INDIAN_MOBILE',
  INVALID_COUNTRY_CODE: 'INVALID_COUNTRY_CODE', 
  INVALID_LENGTH: 'INVALID_PHONE_LENGTH',
  EMPTY_PHONE: 'EMPTY_PHONE_NUMBER',
  INVALID_CHARACTERS: 'INVALID_PHONE_CHARACTERS',
  UNSUPPORTED_COUNTRY: 'UNSUPPORTED_COUNTRY_CODE',
  INTERNATIONAL_NOT_ALLOWED: 'INTERNATIONAL_NOT_ALLOWED'
};

/**
 * Phone validation error messages
 */
const PHONE_ERROR_MESSAGES = {
  [PHONE_ERROR_CODES.INVALID_FORMAT]: 'Invalid phone number format',
  [PHONE_ERROR_CODES.INVALID_INDIAN_MOBILE]: 'Indian mobile numbers must be 10 digits starting with 6, 7, 8, or 9',
  [PHONE_ERROR_CODES.INVALID_COUNTRY_CODE]: 'Invalid country code',
  [PHONE_ERROR_CODES.INVALID_LENGTH]: 'Phone number length is invalid for the specified country',
  [PHONE_ERROR_CODES.EMPTY_PHONE]: 'Phone number is required',
  [PHONE_ERROR_CODES.INVALID_CHARACTERS]: 'Phone number contains invalid characters',
  [PHONE_ERROR_CODES.UNSUPPORTED_COUNTRY]: 'Country code is not supported',
  [PHONE_ERROR_CODES.INTERNATIONAL_NOT_ALLOWED]: 'International phone numbers are not allowed'
};

// ─── Core Validation Functions ─────────────────────────────────────────────────

/**
 * Clean and normalize phone number by removing separators and formatting
 * 
 * @param {string} phone - Raw phone number input
 * @returns {string} Cleaned phone number with only digits and +
 */
function cleanPhoneNumber(phone) {
  if (typeof phone !== 'string') {
    return '';
  }
  
  // Remove all separators except + (preserve for country code)
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Handle special cases for Indian numbers
  if (cleaned.startsWith('0091')) {
    cleaned = '+91' + cleaned.substring(4);
  } else if (cleaned.match(/^091[6-9]\d{9}$/)) {
    cleaned = '+91' + cleaned.substring(3);
  } else if (cleaned.match(/^91[6-9]/)) {
    cleaned = '+91' + cleaned.substring(2);
  } else if (cleaned.match(/^0[6-9]\d{9}$/)) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.match(/^[6-9]\d{9}$/)) {
    // Pure 10-digit Indian mobile, don't add country code automatically
    // Let the validation functions decide format
    return cleaned;
  }
  
  return cleaned;
}

/**
 * Extract country code from international phone number
 * 
 * @param {string} phone - Cleaned international phone number starting with +
 * @returns {Object} { countryCode: number, nationalNumber: string } or null
 */
function extractCountryCode(phone) {
  if (!phone.startsWith('+')) {
    return null;
  }
  
  const digits = phone.substring(1);
  
  // Try different country code lengths (1-4 digits)
  for (let i = 1; i <= 4 && i <= digits.length; i++) {
    const potentialCode = parseInt(digits.substring(0, i));
    
    if (COUNTRY_CODES[potentialCode]) {
      const nationalNumber = digits.substring(i);
      return {
        countryCode: potentialCode,
        nationalNumber: nationalNumber,
        country: COUNTRY_CODES[potentialCode].country
      };
    }
  }
  
  return null;
}
/**
 * Validate Indian mobile number format
 * 
 * @param {string} phone - Phone number to validate (cleaned)
 * @returns {Object} Validation result with success status and details
 */
function validateIndianMobile(phone) {
  // Check for 10-digit format starting with 6-9
  if (INDIAN_MOBILE_PATTERN.test(phone)) {
    return {
      isValid: true,
      type: 'indian_mobile',
      countryCode: 91,
      nationalNumber: phone,
      formatted: `+91 ${phone.substring(0, 5)} ${phone.substring(5)}`,
      normalized: `+91${phone}`
    };
  }
  
  // Check for numbers with Indian country code
  for (const [pattern, regex] of Object.entries(INDIAN_WITH_CODE_PATTERNS)) {
    if (regex.test(phone)) {
      let nationalNumber;
      
      if (pattern === 'plus91') {
        nationalNumber = phone.substring(3); // Remove +91
      } else if (pattern === 'code91') {
        nationalNumber = phone.substring(2); // Remove 91
      } else if (pattern === 'zero91') {
        nationalNumber = phone.substring(4); // Remove 0091
      }
      
      return {
        isValid: true,
        type: 'indian_mobile',
        countryCode: 91,
        nationalNumber: nationalNumber,
        formatted: `+91 ${nationalNumber.substring(0, 5)} ${nationalNumber.substring(5)}`,
        normalized: `+91${nationalNumber}`
      };
    }
  }
  
  return {
    isValid: false,
    error: PHONE_ERROR_CODES.INVALID_INDIAN_MOBILE,
    message: PHONE_ERROR_MESSAGES[PHONE_ERROR_CODES.INVALID_INDIAN_MOBILE]
  };
}

/**
 * Validate international phone number in E.164 format
 * 
 * @param {string} phone - Phone number to validate (cleaned)
 * @returns {Object} Validation result with success status and details
 */
function validateInternationalPhone(phone) {
  // Must start with + for international format
  if (!phone.startsWith('+')) {
    return {
      isValid: false,
      error: PHONE_ERROR_CODES.INVALID_FORMAT,
      message: 'International numbers must start with country code (+)'
    };
  }
  if (phone.startsWith('+0')) {
    return {
      isValid: false,
      error: PHONE_ERROR_CODES.INVALID_COUNTRY_CODE,
      message: PHONE_ERROR_MESSAGES[PHONE_ERROR_CODES.INVALID_COUNTRY_CODE]
    };
  }
  
  // Check basic E.164 format
  if (!INTERNATIONAL_E164_PATTERN.test(phone)) {
    return {
      isValid: false,
      error: PHONE_ERROR_CODES.INVALID_FORMAT,
      message: 'Invalid international phone number format (E.164)'
    };
  }
  
  // Extract and validate country code
  const codeInfo = extractCountryCode(phone);
  if (!codeInfo) {
    return {
      isValid: false,
      error: PHONE_ERROR_CODES.INVALID_COUNTRY_CODE,
      message: PHONE_ERROR_MESSAGES[PHONE_ERROR_CODES.INVALID_COUNTRY_CODE]
    };
  }
  
  const { countryCode, nationalNumber, country } = codeInfo;
  const countryInfo = COUNTRY_CODES[countryCode];
  
  // Validate national number length for the country
  const totalLength = nationalNumber.length;
  if (totalLength < countryInfo.minLength || totalLength > countryInfo.maxLength) {
    return {
      isValid: false,
      error: PHONE_ERROR_CODES.INVALID_LENGTH,
      message: `Phone number length invalid for ${country}. Expected ${countryInfo.minLength}-${countryInfo.maxLength} digits, got ${totalLength}`
    };
  }
  
  return {
    isValid: true,
    type: 'international',
    countryCode: countryCode,
    nationalNumber: nationalNumber,
    country: country,
    formatted: formatInternationalPhone(countryCode, nationalNumber),
    normalized: phone
  };
}
// ─── Formatting Functions ──────────────────────────────────────────────────────

/**
 * Format Indian mobile number for display
 * 
 * @param {string} nationalNumber - 10-digit national number
 * @param {Object} options - Formatting options
 * @param {boolean} [options.includeCountryCode=true] - Include +91 country code
 * @param {string} [options.separator=' '] - Separator between groups
 * @returns {string} Formatted phone number
 */
function formatIndianMobile(nationalNumber, options = {}) {
  const {
    includeCountryCode = true,
    separator = ' '
  } = options;
  
  if (!nationalNumber || nationalNumber.length !== 10) {
    return nationalNumber;
  }
  
  // Format as XXXXX XXXXX
  const formatted = `${nationalNumber.substring(0, 5)}${separator}${nationalNumber.substring(5)}`;
  
  if (includeCountryCode) {
    return `+91${separator}${formatted}`;
  }
  
  return formatted;
}

/**
 * Format international phone number for display
 * 
 * @param {number} countryCode - Country code number
 * @param {string} nationalNumber - National number
 * @param {Object} options - Formatting options
 * @param {string} [options.separator=' '] - Separator between parts
 * @returns {string} Formatted international phone number
 */
function formatInternationalPhone(countryCode, nationalNumber, options = {}) {
  const { separator = ' ' } = options;
  
  // Basic formatting - country code + national number
  // Advanced formatting could be added per country if needed
  if (nationalNumber.length >= 6) {
    // Split national number for better readability
    const firstPart = nationalNumber.substring(0, Math.ceil(nationalNumber.length / 2));
    const secondPart = nationalNumber.substring(Math.ceil(nationalNumber.length / 2));
    return `+${countryCode}${separator}${firstPart}${separator}${secondPart}`;
  }
  
  return `+${countryCode}${separator}${nationalNumber}`;
}

// ─── Main Validation Function ──────────────────────────────────────────────────

/**
 * Main phone number validation function
 * 
 * Validates phone numbers supporting Indian mobile numbers (primary) and 
 * international formats. Implements comprehensive validation as per R3.1.
 * 
 * @param {string} phone - Phone number to validate
 * @param {Object} options - Validation options
 * @param {boolean} [options.allowInternational=true] - Allow international numbers
 * @param {boolean} [options.requireIndian=false] - Require Indian numbers only
 * @param {boolean} [options.autoFormat=true] - Auto-format valid numbers
 * @param {boolean} [options.strictE164=false] - Strict E.164 format for international
 * @returns {Object} Comprehensive validation result
 */
function validatePhone(phone, options = {}) {
  const {
    allowInternational = true,
    requireIndian = false,
  } = options;
  
  // Input validation
  if (!phone || typeof phone !== 'string') {
    return {
      isValid: false,
      error: PHONE_ERROR_CODES.EMPTY_PHONE,
      message: PHONE_ERROR_MESSAGES[PHONE_ERROR_CODES.EMPTY_PHONE],
      input: phone
    };
  }
  
  // Clean the input
  const cleaned = cleanPhoneNumber(phone.trim());
  
  if (!cleaned) {
    return {
      isValid: false,
      error: PHONE_ERROR_CODES.EMPTY_PHONE,
      message: PHONE_ERROR_MESSAGES[PHONE_ERROR_CODES.EMPTY_PHONE],
      input: phone
    };
  }
  
  // Check for invalid characters (only digits and + allowed)
  if (!/^[\+\d]+$/.test(cleaned)) {
    return {
      isValid: false,
      error: PHONE_ERROR_CODES.INVALID_CHARACTERS,
      message: PHONE_ERROR_MESSAGES[PHONE_ERROR_CODES.INVALID_CHARACTERS],
      input: phone
    };
  }
  // Priority 1: Try Indian mobile validation first (primary requirement)
  const indianResult = validateIndianMobile(cleaned);
  if (indianResult.isValid) {
    return {
      ...indianResult,
      input: phone,
      cleaned: cleaned
    };
  }
  
  // If requireIndian is true, don't try international validation
  if (requireIndian) {
    return {
      ...indianResult,
      input: phone,
      cleaned: cleaned
    };
  }
  
  // Priority 2: Try international validation if allowed
  if (allowInternational) {
    // For international numbers, ensure they start with +
    let internationalPhone = cleaned;
    if (!cleaned.startsWith('+') && cleaned.length > 10) {
      // Don't auto-add + for potential Indian numbers
      if (!cleaned.match(/^[6-9]/)) {
        internationalPhone = '+' + cleaned;
      }
    }
    
    if (internationalPhone.startsWith('+')) {
      const internationalResult = validateInternationalPhone(internationalPhone);
      if (internationalResult.isValid) {
        return {
          ...internationalResult,
          input: phone,
          cleaned: cleaned
        };
      }
      
      // Return international error if it was clearly intended as international
      if (cleaned.startsWith('+') || cleaned.length > 12) {
        return {
          ...internationalResult,
          input: phone,
          cleaned: cleaned
        };
      }
    }
  } else {
    // International not allowed but number looks international
    if (cleaned.startsWith('+') || cleaned.length > 11) {
      return {
        isValid: false,
        error: PHONE_ERROR_CODES.INTERNATIONAL_NOT_ALLOWED,
        message: PHONE_ERROR_MESSAGES[PHONE_ERROR_CODES.INTERNATIONAL_NOT_ALLOWED],
        input: phone,
        cleaned: cleaned
      };
    }
  }
  
  // If we get here, neither format worked - return the Indian error since it's primary
  return {
    ...indianResult,
    input: phone,
    cleaned: cleaned
  };
}

// ─── Normalization Functions ───────────────────────────────────────────────────

/**
 * Normalize phone number to standard E.164 format
 * 
 * @param {string} phone - Phone number to normalize
 * @param {Object} options - Normalization options
 * @returns {Object} Normalization result with normalized number
 */
function normalizePhone(phone, options = {}) {
  const validation = validatePhone(phone, options);
  
  if (!validation.isValid) {
    return {
      isValid: false,
      error: validation.error,
      message: validation.message,
      original: phone
    };
  }
  
  return {
    isValid: true,
    original: phone,
    normalized: validation.normalized,
    formatted: validation.formatted,
    type: validation.type,
    countryCode: validation.countryCode,
    nationalNumber: validation.nationalNumber
  };
}

/**
 * Format phone number for display purposes
 * 
 * @param {string} phone - Phone number to format
 * @param {Object} options - Formatting options
 * @param {string} [options.format='display'] - Format type: 'display', 'international', 'national'
 * @param {string} [options.separator=' '] - Separator between number groups
 * @returns {Object} Formatting result
 */
function formatPhone(phone, options = {}) {
  const { format = 'display' } = options;
  
  const validation = validatePhone(phone, options);
  
  if (!validation.isValid) {
    return {
      isValid: false,
      error: validation.error,
      message: validation.message,
      original: phone
    };
  }
  
  let formatted;
  
  switch (format) {
    case 'international':
      formatted = validation.normalized;
      break;
    case 'national':
      formatted = validation.nationalNumber;
      break;
    case 'display':
    default:
      formatted = validation.formatted;
      break;
  }
  
  return {
    isValid: true,
    original: phone,
    formatted: formatted,
    type: validation.type,
    countryCode: validation.countryCode
  };
}
// ─── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Check if phone number is Indian mobile number
 * 
 * @param {string} phone - Phone number to check
 * @returns {boolean} True if Indian mobile number
 */
function isIndianMobile(phone) {
  const result = validatePhone(phone, { requireIndian: true });
  return result.isValid && result.type === 'indian_mobile';
}

/**
 * Check if phone number is international format
 * 
 * @param {string} phone - Phone number to check  
 * @returns {boolean} True if international format
 */
function isInternationalPhone(phone) {
  const result = validatePhone(phone);
  return result.isValid && result.type === 'international';
}

/**
 * Get country information for phone number
 * 
 * @param {string} phone - Phone number to analyze
 * @returns {Object|null} Country information or null if not found
 */
function getCountryInfo(phone) {
  const result = validatePhone(phone);
  
  if (!result.isValid) {
    return null;
  }
  
  const countryData = COUNTRY_CODES[result.countryCode];
  if (!countryData) {
    return null;
  }
  
  return {
    countryCode: result.countryCode,
    country: result.country || countryData.country,
    minLength: countryData.minLength,
    maxLength: countryData.maxLength
  };
}

/**
 * Batch validate multiple phone numbers
 * 
 * @param {Array<string>} phones - Array of phone numbers to validate
 * @param {Object} options - Validation options (same as validatePhone)
 * @returns {Array<Object>} Array of validation results
 */
function validatePhonesBatch(phones, options = {}) {
  if (!Array.isArray(phones)) {
    throw new Error('Input must be an array of phone numbers');
  }
  
  return phones.map((phone, index) => ({
    index,
    phone,
    ...validatePhone(phone, options)
  }));
}

// ─── Zod Integration Helper ────────────────────────────────────────────────────

/**
 * Create Zod schema for phone number validation
 * Integrates with the existing Zod validation framework
 * 
 * @param {Object} options - Validation options
 * @returns {import('zod').ZodEffects} Zod schema with phone validation
 */
function createPhoneSchema(options = {}) {
  const { z } = require('zod/v4');

  return z.string()
    .min(1, 'Phone number is required')
    .transform((phone) => phone.trim())
    .superRefine((phone, ctx) => {
      const result = validatePhone(phone, options);
      if (!result.isValid) ctx.addIssue({ code: 'custom', message: `Invalid phone number: ${result.message || 'invalid format'}` });
    })
    .transform((phone) => {
      const result = validatePhone(phone, options);
      return result.normalized || phone;
    });
}

// ─── Module Exports ─────────────────────────────────────────────────────────────

module.exports = {
  // Main validation functions
  validatePhone,
  normalizePhone,
  formatPhone,
  
  // Utility functions
  cleanPhoneNumber,
  isIndianMobile,
  isInternationalPhone,
  getCountryInfo,
  validatePhonesBatch,
  
  // Formatting functions
  formatIndianMobile,
  formatInternationalPhone,
  
  // Internal validation functions (for testing)
  validateIndianMobile,
  validateInternationalPhone,
  extractCountryCode,
  
  // Zod integration
  createPhoneSchema,
  
  // Constants and configuration
  PHONE_ERROR_CODES,
  PHONE_ERROR_MESSAGES,
  COUNTRY_CODES,
  INDIAN_MOBILE_PATTERN,
  INTERNATIONAL_E164_PATTERN,
  
  // Patterns for external use
  patterns: {
    INDIAN_MOBILE_PATTERN,
    INDIAN_WITH_CODE_PATTERNS,
    INTERNATIONAL_E164_PATTERN,
    PHONE_SEPARATORS
  }
};
