'use strict';

/**
 * PIN Code Validator Module
 * 
 * Provides comprehensive Indian PIN code validation supporting 6-digit postal codes
 * with region validation and normalization as specified in R3.2.
 * 
 * Features:
 * - Indian 6-digit PIN code format validation
 * - Region extraction from PIN code first digit
 * - PIN code normalization and formatting
 * - Comprehensive error reporting with specific error codes
 * 
 * @module PincodeValidator
 */

// ─── PIN Code Patterns ─────────────────────────────────────────────────────────

/**
 * Indian PIN code pattern
 * Matches exactly 6 digits (000001 to 999999)
 */
const PINCODE_PATTERN = /^[1-9]\d{5}$/;

/**
 * PIN code with optional spaces pattern
 * Matches 6 digits with optional spaces for user input flexibility
 */
const PINCODE_WITH_SPACES_PATTERN = /^[1-9]\s?\d\s?\d\s?\d\s?\d\s?\d$/;

// ─── PIN Code Region Mapping ───────────────────────────────────────────────────

/**
 * Indian postal regions mapped by first digit of PIN code
 * First digit indicates the postal region in India
 * 
 * Reference: India Post PIN code system
 */
const POSTAL_REGIONS = {
  1: { region: 'Delhi, Punjab, Haryana, Himachal Pradesh, Jammu & Kashmir, Chandigarh' },
  2: { region: 'Uttar Pradesh, Uttarakhand' },
  3: { region: 'Rajasthan, Gujarat, Daman & Diu, Dadra & Nagar Haveli' },
  4: { region: 'Maharashtra, Goa, Madhya Pradesh, Chhattisgarh' },
  5: { region: 'Andhra Pradesh, Telangana, Karnataka' },
  6: { region: 'Tamil Nadu, Kerala, Puducherry, Lakshadweep' },
  7: { region: 'West Bengal, Odisha, Assam, Arunachal Pradesh, Nagaland, Manipur, Mizoram, Tripura, Meghalaya, Andaman & Nicobar Islands, Sikkim' },
  8: { region: 'Bihar, Jharkhand' },
  9: { region: 'Reserved for Army Post Office (APO) & Field Post Office (FPO)' }
};

/**
 * Special PIN code ranges for important locations
 */
const SPECIAL_PINCODES = {
  // Parliament House, New Delhi
  110001: { location: 'Parliament House', city: 'New Delhi', state: 'Delhi' },
  
  // Rashtrapati Bhavan (President House), New Delhi
  110004: { location: 'Rashtrapati Bhavan', city: 'New Delhi', state: 'Delhi' },
  
  // Mumbai GPO
  400001: { location: 'Mumbai GPO', city: 'Mumbai', state: 'Maharashtra' },
  
  // Kolkata GPO
  700001: { location: 'Kolkata GPO', city: 'Kolkata', state: 'West Bengal' },
  
  // Chennai GPO
  600001: { location: 'Chennai GPO', city: 'Chennai', state: 'Tamil Nadu' },
  
  // Bangalore GPO
  560001: { location: 'Bangalore GPO', city: 'Bangalore', state: 'Karnataka' },
  
  // Hyderabad GPO
  500001: { location: 'Hyderabad GPO', city: 'Hyderabad', state: 'Telangana' },
};

// ─── PIN Code Error Codes ──────────────────────────────────────────────────────

/**
 * PIN code validation error codes for consistent error reporting
 */
const PINCODE_ERROR_CODES = {
  INVALID_FORMAT: 'INVALID_PINCODE_FORMAT',
  INVALID_LENGTH: 'INVALID_PINCODE_LENGTH',
  EMPTY_PINCODE: 'EMPTY_PINCODE',
  INVALID_CHARACTERS: 'INVALID_PINCODE_CHARACTERS',
  INVALID_STARTING_DIGIT: 'INVALID_PINCODE_STARTING_DIGIT',
  PINCODE_TOO_SHORT: 'PINCODE_TOO_SHORT',
  PINCODE_TOO_LONG: 'PINCODE_TOO_LONG',
  INVALID_REGION: 'INVALID_PINCODE_REGION',
};

/**
 * PIN code validation error messages
 */
const PINCODE_ERROR_MESSAGES = {
  [PINCODE_ERROR_CODES.INVALID_FORMAT]: 'Invalid PIN code format. Must be 6 digits.',
  [PINCODE_ERROR_CODES.INVALID_LENGTH]: 'PIN code must be exactly 6 digits',
  [PINCODE_ERROR_CODES.EMPTY_PINCODE]: 'PIN code is required',
  [PINCODE_ERROR_CODES.INVALID_CHARACTERS]: 'PIN code must contain only digits',
  [PINCODE_ERROR_CODES.INVALID_STARTING_DIGIT]: 'PIN code cannot start with 0',
  [PINCODE_ERROR_CODES.PINCODE_TOO_SHORT]: 'PIN code is too short. Must be 6 digits.',
  [PINCODE_ERROR_CODES.PINCODE_TOO_LONG]: 'PIN code is too long. Must be 6 digits.',
  [PINCODE_ERROR_CODES.INVALID_REGION]: 'Invalid PIN code region',
};

// ─── Core Validation Functions ─────────────────────────────────────────────────

/**
 * Clean and normalize PIN code
 * Removes spaces, dashes, and other non-digit characters
 * 
 * @param {string} pincode - Raw PIN code input
 * @returns {string} Cleaned PIN code with only digits
 */
function cleanPincode(pincode) {
  if (typeof pincode !== 'string') {
    return '';
  }
  
  // Remove all non-digit characters (spaces, dashes, etc.)
  return pincode.replace(/\D/g, '');
}

/**
 * Extract region information from PIN code
 * Uses the first digit to determine the postal region
 * 
 * @param {string} pincode - 6-digit PIN code
 * @returns {Object|null} Region information or null if invalid
 */
function extractRegion(pincode) {
  if (!pincode || pincode.length !== 6) {
    return null;
  }
  
  const firstDigit = parseInt(pincode.charAt(0));
  
  if (!POSTAL_REGIONS[firstDigit]) {
    return null;
  }
  
  return {
    code: firstDigit,
    region: POSTAL_REGIONS[firstDigit].region,
  };
}

/**
 * Check if PIN code is a special location
 * 
 * @param {string} pincode - 6-digit PIN code
 * @returns {Object|null} Special location info or null
 */
function getSpecialLocation(pincode) {
  const pincodeNum = parseInt(pincode, 10);
  return SPECIAL_PINCODES[pincodeNum] || null;
}

/**
 * Validate PIN code format and structure
 * 
 * @param {string} pincode - Cleaned PIN code to validate
 * @returns {Object} Validation result with success status and details
 */
function validatePincodeFormat(pincode) {
  // Check if PIN code matches the basic 6-digit pattern
  if (!PINCODE_PATTERN.test(pincode)) {
    // Provide more specific error messages
    if (pincode.length < 6) {
      return {
        isValid: false,
        error: PINCODE_ERROR_CODES.PINCODE_TOO_SHORT,
        message: PINCODE_ERROR_MESSAGES[PINCODE_ERROR_CODES.PINCODE_TOO_SHORT]
      };
    }
    
    if (pincode.length > 6) {
      return {
        isValid: false,
        error: PINCODE_ERROR_CODES.PINCODE_TOO_LONG,
        message: PINCODE_ERROR_MESSAGES[PINCODE_ERROR_CODES.PINCODE_TOO_LONG]
      };
    }
    
    if (pincode.charAt(0) === '0') {
      return {
        isValid: false,
        error: PINCODE_ERROR_CODES.INVALID_STARTING_DIGIT,
        message: PINCODE_ERROR_MESSAGES[PINCODE_ERROR_CODES.INVALID_STARTING_DIGIT]
      };
    }
    
    return {
      isValid: false,
      error: PINCODE_ERROR_CODES.INVALID_FORMAT,
      message: PINCODE_ERROR_MESSAGES[PINCODE_ERROR_CODES.INVALID_FORMAT]
    };
  }
  
  return { isValid: true };
}

/**
 * Validate PIN code region
 * 
 * @param {string} pincode - 6-digit PIN code
 * @returns {Object} Validation result with region information
 */
function validatePincodeRegion(pincode) {
  const region = extractRegion(pincode);
  
  if (!region) {
    return {
      isValid: false,
      error: PINCODE_ERROR_CODES.INVALID_REGION,
      message: PINCODE_ERROR_MESSAGES[PINCODE_ERROR_CODES.INVALID_REGION]
    };
  }
  
  return {
    isValid: true,
    region: region
  };
}

// ─── Main Validation Function ──────────────────────────────────────────────────

/**
 * Main PIN code validation function
 * 
 * Validates Indian 6-digit PIN codes with region validation and
 * normalization as per R3.2.
 * 
 * @param {string} pincode - PIN code to validate
 * @param {Object} options - Validation options
 * @param {boolean} [options.validateRegion=true] - Validate postal region
 * @param {boolean} [options.allowSpecialPincodes=true] - Allow special/reserved PIN codes
 * @param {boolean} [options.strictFormat=true] - Strict format validation (no spaces/dashes)
 * @returns {Object} Comprehensive validation result
 */
function validatePincode(pincode, options = {}) {
  const {
    validateRegion = true,
    allowSpecialPincodes = true,
    strictFormat = true
  } = options;
  
  // Input validation
  if (!pincode || typeof pincode !== 'string') {
    return {
      isValid: false,
      error: PINCODE_ERROR_CODES.EMPTY_PINCODE,
      message: PINCODE_ERROR_MESSAGES[PINCODE_ERROR_CODES.EMPTY_PINCODE],
      input: pincode
    };
  }
  
  // Clean the input
  const cleaned = cleanPincode(pincode.trim());
  
  if (!cleaned) {
    return {
      isValid: false,
      error: PINCODE_ERROR_CODES.EMPTY_PINCODE,
      message: PINCODE_ERROR_MESSAGES[PINCODE_ERROR_CODES.EMPTY_PINCODE],
      input: pincode
    };
  }
  
  // Check for non-digit characters if strict format is enabled
  if (strictFormat && pincode.trim() !== cleaned) {
    // Check if it would be valid without the extra characters
    if (cleaned.length === 6 && PINCODE_PATTERN.test(cleaned)) {
      // Valid PIN code but with extra formatting - warn but accept
    } else {
      return {
        isValid: false,
        error: PINCODE_ERROR_CODES.INVALID_CHARACTERS,
        message: PINCODE_ERROR_MESSAGES[PINCODE_ERROR_CODES.INVALID_CHARACTERS],
        input: pincode,
        cleaned: cleaned
      };
    }
  }
  
  // Validate PIN code format
  const formatValidation = validatePincodeFormat(cleaned);
  if (!formatValidation.isValid) {
    return {
      ...formatValidation,
      input: pincode,
      cleaned: cleaned
    };
  }
  
  // Validate region if requested
  let regionInfo = null;
  if (validateRegion) {
    const regionValidation = validatePincodeRegion(cleaned);
    if (!regionValidation.isValid) {
      return {
        ...regionValidation,
        input: pincode,
        cleaned: cleaned,
        normalized: cleaned
      };
    }
    regionInfo = regionValidation.region;
  } else {
    // Extract region info even if not validating
    regionInfo = extractRegion(cleaned);
  }
  
  // Check for special location
  const specialLocation = getSpecialLocation(cleaned);
  
  // All validations passed
  return {
    isValid: true,
    input: pincode,
    cleaned: cleaned,
    normalized: cleaned, // PIN code is already normalized
    region: regionInfo,
    specialLocation: specialLocation,
    formatted: formatPincode(cleaned)
  };
}

// ─── Formatting Functions ──────────────────────────────────────────────────────

/**
 * Format PIN code for display
 * 
 * @param {string} pincode - 6-digit PIN code
 * @param {Object} options - Formatting options
 * @param {string} [options.separator=''] - Separator between groups (e.g., space or dash)
 * @param {boolean} [options.grouping=false] - Group digits (e.g., 110 001)
 * @returns {string} Formatted PIN code
 */
function formatPincode(pincode, options = {}) {
  const {
    separator = '',
    grouping = false
  } = options;
  
  if (!pincode || pincode.length !== 6) {
    return pincode;
  }
  
  // If grouping requested, format as XXX XXX
  if (grouping && separator) {
    return `${pincode.substring(0, 3)}${separator}${pincode.substring(3)}`;
  }
  
  return pincode;
}

// ─── Normalization Functions ───────────────────────────────────────────────────

/**
 * Normalize PIN code to standard 6-digit format
 * 
 * @param {string} pincode - PIN code to normalize
 * @param {Object} options - Normalization options
 * @returns {Object} Normalization result with normalized PIN code
 */
function normalizePincode(pincode, options = {}) {
  const validation = validatePincode(pincode, options);
  
  if (!validation.isValid) {
    return {
      isValid: false,
      error: validation.error,
      message: validation.message,
      original: pincode
    };
  }
  
  return {
    isValid: true,
    original: pincode,
    normalized: validation.normalized,
    formatted: validation.formatted,
    region: validation.region,
    specialLocation: validation.specialLocation
  };
}

// ─── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Check if PIN code is valid
 * Quick check for PIN code validity
 * 
 * @param {string} pincode - PIN code to check
 * @param {Object} options - Validation options
 * @returns {boolean} True if PIN code is valid
 */
function isValidPincode(pincode, options = {}) {
  const result = validatePincode(pincode, options);
  return result.isValid;
}

/**
 * Get region information for a PIN code
 * 
 * @param {string} pincode - PIN code to analyze
 * @returns {Object|null} Region information or null if invalid
 */
function getRegionInfo(pincode) {
  const validation = validatePincode(pincode);
  
  if (!validation.isValid) {
    return null;
  }
  
  return {
    code: validation.region.code,
    region: validation.region.region,
    specialLocation: validation.specialLocation
  };
}

/**
 * Check if PIN code belongs to a specific region code
 * 
 * @param {string} pincode - PIN code to check
 * @param {number} regionCode - Region code (1-9)
 * @returns {boolean} True if PIN code belongs to the region
 */
function isInRegion(pincode, regionCode) {
  const validation = validatePincode(pincode);
  
  if (!validation.isValid || !validation.region) {
    return false;
  }
  
  return validation.region.code === regionCode;
}

/**
 * Check if PIN code is a special/reserved location
 * 
 * @param {string} pincode - PIN code to check
 * @returns {boolean} True if PIN code is special
 */
function isSpecialPincode(pincode) {
  const validation = validatePincode(pincode);
  
  if (!validation.isValid) {
    return false;
  }
  
  return validation.specialLocation !== null;
}

/**
 * Batch validate multiple PIN codes
 * 
 * @param {Array<string>} pincodes - Array of PIN codes to validate
 * @param {Object} options - Validation options (same as validatePincode)
 * @returns {Array<Object>} Array of validation results
 */
function validatePincodesBatch(pincodes, options = {}) {
  if (!Array.isArray(pincodes)) {
    throw new Error('Input must be an array of PIN codes');
  }
  
  return pincodes.map((pincode, index) => ({
    index,
    pincode,
    ...validatePincode(pincode, options)
  }));
}

// ─── Zod Integration Helper ────────────────────────────────────────────────────

/**
 * Create Zod schema for PIN code validation
 * Integrates with the existing Zod validation framework
 * 
 * @param {Object} options - Validation options
 * @returns {import('zod').ZodEffects} Zod schema with PIN code validation
 */
function createPincodeSchema(options = {}) {
  const z = require('zod');
  
  return z.string()
    .min(1, 'PIN code is required')
    .transform((pincode) => cleanPincode(pincode.trim()))
    .refine(
      (pincode) => validatePincode(pincode, options).isValid,
      (pincode) => {
        const result = validatePincode(pincode, options);
        return {
          message: result.message || 'Invalid PIN code',
          code: result.error || 'INVALID_PINCODE'
        };
      }
    )
    .transform((pincode) => {
      const result = validatePincode(pincode, options);
      return result.normalized || pincode;
    });
}

// ─── Module Exports ─────────────────────────────────────────────────────────────

module.exports = {
  // Main validation functions
  validatePincode,
  normalizePincode,
  formatPincode,
  
  // Utility functions
  cleanPincode,
  isValidPincode,
  getRegionInfo,
  isInRegion,
  isSpecialPincode,
  validatePincodesBatch,
  
  // Internal validation functions (for testing)
  validatePincodeFormat,
  validatePincodeRegion,
  extractRegion,
  getSpecialLocation,
  
  // Zod integration
  createPincodeSchema,
  
  // Constants and configuration
  PINCODE_ERROR_CODES,
  PINCODE_ERROR_MESSAGES,
  POSTAL_REGIONS,
  SPECIAL_PINCODES,
  
  // Patterns for external use
  patterns: {
    PINCODE_PATTERN,
    PINCODE_WITH_SPACES_PATTERN
  }
};
