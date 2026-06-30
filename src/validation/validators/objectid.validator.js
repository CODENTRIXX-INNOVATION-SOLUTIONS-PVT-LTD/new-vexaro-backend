'use strict';

/**
 * ObjectId Validator Module
 * 
 * Provides comprehensive MongoDB ObjectId validation supporting format validation,
 * existence checking, and reference integrity validation as specified in R3.5.
 * 
 * Features:
 * - MongoDB ObjectId format validation (24 character hexadecimal)
 * - Mongoose ObjectId compatibility checking
 * - Optional database existence validation
 * - Reference integrity checks
 * - Timestamp extraction from ObjectId
 * - Comprehensive error reporting with specific error codes
 * 
 * @module ObjectIdValidator
 */

// ─── ObjectId Patterns ─────────────────────────────────────────────────────────

/**
 * MongoDB ObjectId pattern
 * Matches exactly 24 hexadecimal characters (0-9, a-f, A-F)
 * 
 * ObjectId structure (24 hex characters = 12 bytes):
 * - 4 bytes: Unix timestamp (seconds since epoch)
 * - 5 bytes: Random value
 * - 3 bytes: Incrementing counter
 */
const OBJECTID_PATTERN = /^[a-f\d]{24}$/i;

/**
 * Strict lowercase ObjectId pattern
 * MongoDB typically stores ObjectIds in lowercase
 */
const OBJECTID_PATTERN_STRICT = /^[a-f0-9]{24}$/;

// ─── ObjectId Error Codes ──────────────────────────────────────────────────────

/**
 * ObjectId validation error codes for consistent error reporting
 */
const OBJECTID_ERROR_CODES = {
  INVALID_FORMAT: 'INVALID_OBJECTID_FORMAT',
  INVALID_LENGTH: 'INVALID_OBJECTID_LENGTH',
  EMPTY_OBJECTID: 'EMPTY_OBJECTID',
  INVALID_CHARACTERS: 'INVALID_OBJECTID_CHARACTERS',
  OBJECTID_TOO_SHORT: 'OBJECTID_TOO_SHORT',
  OBJECTID_TOO_LONG: 'OBJECTID_TOO_LONG',
  INVALID_TIMESTAMP: 'INVALID_OBJECTID_TIMESTAMP',
  FUTURE_TIMESTAMP: 'OBJECTID_FUTURE_TIMESTAMP',
  NOT_FOUND: 'OBJECTID_NOT_FOUND',
  REFERENCE_INTEGRITY_FAILED: 'OBJECTID_REFERENCE_INTEGRITY_FAILED',
  INVALID_TYPE: 'INVALID_OBJECTID_TYPE',
};

/**
 * ObjectId validation error messages
 */
const OBJECTID_ERROR_MESSAGES = {
  [OBJECTID_ERROR_CODES.INVALID_FORMAT]: 'Invalid ObjectId format. Must be 24 hexadecimal characters.',
  [OBJECTID_ERROR_CODES.INVALID_LENGTH]: 'ObjectId must be exactly 24 characters',
  [OBJECTID_ERROR_CODES.EMPTY_OBJECTID]: 'ObjectId is required',
  [OBJECTID_ERROR_CODES.INVALID_CHARACTERS]: 'ObjectId must contain only hexadecimal characters (0-9, a-f)',
  [OBJECTID_ERROR_CODES.OBJECTID_TOO_SHORT]: 'ObjectId is too short. Must be 24 characters.',
  [OBJECTID_ERROR_CODES.OBJECTID_TOO_LONG]: 'ObjectId is too long. Must be 24 characters.',
  [OBJECTID_ERROR_CODES.INVALID_TIMESTAMP]: 'ObjectId contains invalid timestamp',
  [OBJECTID_ERROR_CODES.FUTURE_TIMESTAMP]: 'ObjectId timestamp is in the future',
  [OBJECTID_ERROR_CODES.NOT_FOUND]: 'Referenced document not found',
  [OBJECTID_ERROR_CODES.REFERENCE_INTEGRITY_FAILED]: 'Reference integrity check failed',
  [OBJECTID_ERROR_CODES.INVALID_TYPE]: 'Invalid type. Expected string or ObjectId instance',
};

// ─── Core Validation Functions ─────────────────────────────────────────────────

/**
 * Clean and normalize ObjectId
 * Removes whitespace and converts to lowercase
 * 
 * @param {string|Object} objectId - Raw ObjectId input (string or Mongoose ObjectId)
 * @returns {string} Cleaned ObjectId string in lowercase
 */
function cleanObjectId(objectId) {
  // Handle null/undefined
  if (!objectId) {
    return '';
  }
  
  // Handle Mongoose ObjectId instances (must check before toString)
  if (typeof objectId === 'object') {
    // Check if it's a valid Mongoose ObjectId with proper methods
    if (typeof objectId.toString === 'function' && typeof objectId.toHexString === 'function') {
      objectId = objectId.toString();
    } else {
      // Plain object without proper ObjectId methods
      return '';
    }
  }
  
  // Handle string input
  if (typeof objectId !== 'string') {
    return '';
  }
  
  // Remove whitespace and convert to lowercase
  return objectId.trim().toLowerCase();
}

/**
 * Check if value is a Mongoose ObjectId instance
 * 
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a Mongoose ObjectId instance
 */
function isMongooseObjectId(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  
  // Check for Mongoose ObjectId characteristics
  return (
    value.constructor &&
    value.constructor.name === 'ObjectId' &&
    typeof value.toString === 'function' &&
    typeof value.toHexString === 'function'
  );
}

/**
 * Extract timestamp from ObjectId
 * The first 8 characters (4 bytes) represent the Unix timestamp
 * 
 * @param {string} objectId - 24 character ObjectId string
 * @returns {Date|null} Date object or null if invalid
 */
function extractTimestamp(objectId) {
  if (!objectId || objectId.length !== 24) {
    return null;
  }
  
  try {
    // Extract first 8 hex characters (4 bytes) and convert to timestamp
    const timestamp = parseInt(objectId.substring(0, 8), 16);
    
    // Check if timestamp is valid
    if (isNaN(timestamp) || timestamp < 0) {
      return null;
    }
    
    // Convert to Date (timestamp is in seconds)
    return new Date(timestamp * 1000);
  } catch (error) {
    return null;
  }
}

/**
 * Validate ObjectId timestamp
 * Ensures the timestamp embedded in ObjectId is reasonable
 * 
 * @param {string} objectId - 24 character ObjectId string
 * @returns {Object} Validation result
 */
function validateObjectIdTimestamp(objectId) {
  const timestamp = extractTimestamp(objectId);
  
  if (!timestamp) {
    return {
      isValid: false,
      error: OBJECTID_ERROR_CODES.INVALID_TIMESTAMP,
      message: OBJECTID_ERROR_MESSAGES[OBJECTID_ERROR_CODES.INVALID_TIMESTAMP]
    };
  }
  
  // Check if timestamp is in the future (with 5 minute buffer for clock skew)
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
  
  if (timestamp > fiveMinutesFromNow) {
    return {
      isValid: false,
      error: OBJECTID_ERROR_CODES.FUTURE_TIMESTAMP,
      message: OBJECTID_ERROR_MESSAGES[OBJECTID_ERROR_CODES.FUTURE_TIMESTAMP],
      timestamp: timestamp
    };
  }
  
  // Check if timestamp is before MongoDB existed (2009)
  const mongodbEpoch = new Date('2009-01-01T00:00:00Z');
  if (timestamp < mongodbEpoch) {
    return {
      isValid: false,
      error: OBJECTID_ERROR_CODES.INVALID_TIMESTAMP,
      message: OBJECTID_ERROR_MESSAGES[OBJECTID_ERROR_CODES.INVALID_TIMESTAMP],
      timestamp: timestamp
    };
  }
  
  return {
    isValid: true,
    timestamp: timestamp
  };
}

/**
 * Validate ObjectId format and structure
 * 
 * @param {string} objectId - Cleaned ObjectId string to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
function validateObjectIdFormat(objectId, options = {}) {
  const { strict = false } = options;
  
  // Check length first
  if (objectId.length < 24) {
    return {
      isValid: false,
      error: OBJECTID_ERROR_CODES.OBJECTID_TOO_SHORT,
      message: OBJECTID_ERROR_MESSAGES[OBJECTID_ERROR_CODES.OBJECTID_TOO_SHORT]
    };
  }
  
  if (objectId.length > 24) {
    return {
      isValid: false,
      error: OBJECTID_ERROR_CODES.OBJECTID_TOO_LONG,
      message: OBJECTID_ERROR_MESSAGES[OBJECTID_ERROR_CODES.OBJECTID_TOO_LONG]
    };
  }
  
  // Check pattern (strict or lenient)
  const pattern = strict ? OBJECTID_PATTERN_STRICT : OBJECTID_PATTERN;
  
  if (!pattern.test(objectId)) {
    return {
      isValid: false,
      error: OBJECTID_ERROR_CODES.INVALID_CHARACTERS,
      message: OBJECTID_ERROR_MESSAGES[OBJECTID_ERROR_CODES.INVALID_CHARACTERS]
    };
  }
  
  return { isValid: true };
}

// ─── Main Validation Function ──────────────────────────────────────────────────

/**
 * Main ObjectId validation function
 * 
 * Validates MongoDB ObjectId format, optionally checks timestamp validity,
 * and supports database existence checking as per R3.5.
 * 
 * @param {string|Object} objectId - ObjectId to validate (string or Mongoose ObjectId)
 * @param {Object} options - Validation options
 * @param {boolean} [options.strict=false] - Use strict validation (lowercase only)
 * @param {boolean} [options.validateTimestamp=true] - Validate embedded timestamp
 * @param {boolean} [options.checkExists=false] - Check if document exists in database
 * @param {Function} [options.existsChecker=null] - Custom async function to check existence
 * @param {string} [options.collection=null] - Collection name for existence check
 * @param {Object} [options.model=null] - Mongoose model for existence check
 * @returns {Object|Promise<Object>} Validation result (Promise if checkExists is true)
 */
function validateObjectId(objectId, options = {}) {
  const {
    strict = false,
    validateTimestamp = true,
    checkExists = false,
    existsChecker = null,
    collection = null,
    model = null
  } = options;
  
  // Input validation
  if (!objectId) {
    return {
      isValid: false,
      error: OBJECTID_ERROR_CODES.EMPTY_OBJECTID,
      message: OBJECTID_ERROR_MESSAGES[OBJECTID_ERROR_CODES.EMPTY_OBJECTID],
      input: objectId
    };
  }
  
  // Check if it's a Mongoose ObjectId instance
  const isMongooseInstance = isMongooseObjectId(objectId);
  
  // Clean the input
  const cleaned = cleanObjectId(objectId);
  
  if (!cleaned) {
    return {
      isValid: false,
      error: OBJECTID_ERROR_CODES.INVALID_TYPE,
      message: OBJECTID_ERROR_MESSAGES[OBJECTID_ERROR_CODES.INVALID_TYPE],
      input: objectId
    };
  }
  
  // Validate ObjectId format
  const formatValidation = validateObjectIdFormat(cleaned, { strict });
  if (!formatValidation.isValid) {
    return {
      ...formatValidation,
      input: objectId,
      cleaned: cleaned
    };
  }
  
  // Validate timestamp if requested
  let timestampInfo = null;
  if (validateTimestamp) {
    const timestampValidation = validateObjectIdTimestamp(cleaned);
    if (!timestampValidation.isValid) {
      return {
        ...timestampValidation,
        input: objectId,
        cleaned: cleaned,
        normalized: cleaned
      };
    }
    timestampInfo = timestampValidation.timestamp;
  } else {
    // Extract timestamp even if not validating
    timestampInfo = extractTimestamp(cleaned);
  }
  
  // Synchronous validation result
  const result = {
    isValid: true,
    input: objectId,
    cleaned: cleaned,
    normalized: cleaned,
    timestamp: timestampInfo,
    isMongooseInstance: isMongooseInstance
  };
  
  // If existence check is requested, return a Promise
  if (checkExists) {
    return performExistenceCheck(cleaned, result, { existsChecker, collection, model });
  }
  
  return result;
}

/**
 * Perform database existence check for ObjectId
 * This is an async operation that checks if a document with the given ObjectId exists
 * 
 * @param {string} objectId - Validated ObjectId string
 * @param {Object} baseResult - Base validation result
 * @param {Object} options - Existence check options
 * @returns {Promise<Object>} Validation result with existence check
 */
async function performExistenceCheck(objectId, baseResult, options = {}) {
  const { existsChecker, collection, model } = options;
  
  try {
    let exists = false;
    
    // Use custom existence checker if provided
    if (typeof existsChecker === 'function') {
      exists = await existsChecker(objectId);
    }
    // Use Mongoose model if provided
    else if (model && typeof model.exists === 'function') {
      const doc = await model.exists({ _id: objectId });
      exists = doc !== null;
    }
    // If collection name is provided, would need database connection
    else if (collection) {
      // Note: Actual implementation would require database connection
      // This is a placeholder for the pattern
      throw new Error('Collection-based existence check requires database connection. Use model or existsChecker instead.');
    }
    else {
      // No existence checker provided
      return {
        ...baseResult,
        existsCheckPerformed: false,
        error: 'Existence check requested but no checker provided'
      };
    }
    
    if (!exists) {
      return {
        isValid: false,
        error: OBJECTID_ERROR_CODES.NOT_FOUND,
        message: OBJECTID_ERROR_MESSAGES[OBJECTID_ERROR_CODES.NOT_FOUND],
        input: baseResult.input,
        cleaned: baseResult.cleaned,
        normalized: baseResult.normalized,
        timestamp: baseResult.timestamp,
        existsCheckPerformed: true,
        exists: false
      };
    }
    
    return {
      ...baseResult,
      existsCheckPerformed: true,
      exists: true
    };
    
  } catch (error) {
    return {
      isValid: false,
      error: OBJECTID_ERROR_CODES.REFERENCE_INTEGRITY_FAILED,
      message: OBJECTID_ERROR_MESSAGES[OBJECTID_ERROR_CODES.REFERENCE_INTEGRITY_FAILED],
      input: baseResult.input,
      cleaned: baseResult.cleaned,
      existsCheckPerformed: true,
      checkError: error.message
    };
  }
}

// ─── Reference Integrity Helpers ───────────────────────────────────────────────

/**
 * Create existence checker for a Mongoose model
 * Returns a function that can be used with validateObjectId
 * 
 * @param {Object} model - Mongoose model
 * @returns {Function} Async existence checker function
 */
function createModelExistenceChecker(model) {
  if (!model || typeof model.exists !== 'function') {
    throw new Error('Invalid Mongoose model provided');
  }
  
  return async (objectId) => {
    const doc = await model.exists({ _id: objectId });
    return doc !== null;
  };
}

/**
 * Validate reference integrity for multiple ObjectIds
 * Checks if all referenced documents exist
 * 
 * @param {Array<string>} objectIds - Array of ObjectIds to validate
 * @param {Object} options - Validation options (same as validateObjectId)
 * @returns {Promise<Object>} Validation result with details for all ObjectIds
 */
async function validateReferenceIntegrity(objectIds, options = {}) {
  if (!Array.isArray(objectIds)) {
    throw new Error('Input must be an array of ObjectIds');
  }
  
  // Validate all ObjectIds
  const validations = await Promise.all(
    objectIds.map(async (objectId, index) => ({
      index,
      objectId,
      ...await validateObjectId(objectId, { ...options, checkExists: true })
    }))
  );
  
  // Check if all are valid
  const allValid = validations.every(v => v.isValid);
  const invalidRefs = validations.filter(v => !v.isValid);
  
  return {
    isValid: allValid,
    total: objectIds.length,
    valid: validations.filter(v => v.isValid).length,
    invalid: invalidRefs.length,
    validations: validations,
    invalidReferences: invalidRefs
  };
}

// ─── Normalization Functions ───────────────────────────────────────────────────

/**
 * Normalize ObjectId to standard 24-character lowercase format
 * 
 * @param {string|Object} objectId - ObjectId to normalize
 * @param {Object} options - Normalization options
 * @returns {Object} Normalization result
 */
function normalizeObjectId(objectId, options = {}) {
  const validation = validateObjectId(objectId, options);
  
  // Handle async validation (if checkExists was true)
  if (validation instanceof Promise) {
    return validation.then(result => {
      if (!result.isValid) {
        return {
          isValid: false,
          error: result.error,
          message: result.message,
          original: objectId
        };
      }
      
      return {
        isValid: true,
        original: objectId,
        normalized: result.normalized,
        timestamp: result.timestamp,
        exists: result.exists
      };
    });
  }
  
  // Handle sync validation
  if (!validation.isValid) {
    return {
      isValid: false,
      error: validation.error,
      message: validation.message,
      original: objectId
    };
  }
  
  return {
    isValid: true,
    original: objectId,
    normalized: validation.normalized,
    timestamp: validation.timestamp
  };
}

// ─── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Check if ObjectId is valid
 * Quick check for ObjectId validity
 * 
 * @param {string|Object} objectId - ObjectId to check
 * @param {Object} options - Validation options
 * @returns {boolean|Promise<boolean>} True if ObjectId is valid (Promise if checkExists is true)
 */
function isValidObjectId(objectId, options = {}) {
  const result = validateObjectId(objectId, options);
  
  // Handle async validation
  if (result instanceof Promise) {
    return result.then(r => r.isValid);
  }
  
  return result.isValid;
}

/**
 * Get timestamp from ObjectId
 * 
 * @param {string|Object} objectId - ObjectId to extract timestamp from
 * @returns {Date|null} Date object or null if invalid
 */
function getObjectIdTimestamp(objectId) {
  const cleaned = cleanObjectId(objectId);
  
  if (!cleaned || cleaned.length !== 24) {
    return null;
  }
  
  return extractTimestamp(cleaned);
}

/**
 * Get age of ObjectId in milliseconds
 * 
 * @param {string|Object} objectId - ObjectId to check
 * @returns {number|null} Age in milliseconds or null if invalid
 */
function getObjectIdAge(objectId) {
  const timestamp = getObjectIdTimestamp(objectId);
  
  if (!timestamp) {
    return null;
  }
  
  return Date.now() - timestamp.getTime();
}

/**
 * Compare two ObjectIds for sorting
 * ObjectIds can be compared lexicographically for chronological sorting
 * 
 * @param {string|Object} objectId1 - First ObjectId
 * @param {string|Object} objectId2 - Second ObjectId
 * @returns {number} -1, 0, or 1 for sorting
 */
function compareObjectIds(objectId1, objectId2) {
  const cleaned1 = cleanObjectId(objectId1);
  const cleaned2 = cleanObjectId(objectId2);
  
  if (!cleaned1 || !cleaned2) {
    return 0;
  }
  
  return cleaned1.localeCompare(cleaned2);
}

/**
 * Batch validate multiple ObjectIds
 * 
 * @param {Array<string|Object>} objectIds - Array of ObjectIds to validate
 * @param {Object} options - Validation options (same as validateObjectId)
 * @returns {Array<Object>|Promise<Array<Object>>} Array of validation results
 */
function validateObjectIdsBatch(objectIds, options = {}) {
  if (!Array.isArray(objectIds)) {
    throw new Error('Input must be an array of ObjectIds');
  }
  
  const results = objectIds.map((objectId, index) => ({
    index,
    objectId,
    ...validateObjectId(objectId, options)
  }));
  
  // If any result is a Promise (checkExists was true), return Promise.all
  if (results.some(r => r instanceof Promise)) {
    return Promise.all(results);
  }
  
  return results;
}

// ─── Zod Integration Helper ────────────────────────────────────────────────────

/**
 * Create Zod schema for ObjectId validation
 * Integrates with the existing Zod validation framework
 * 
 * @param {Object} options - Validation options
 * @returns {import('zod').ZodEffects} Zod schema with ObjectId validation
 */
function createObjectIdSchema(options = {}) {
  const z = require('zod');
  
  // If checkExists is true, we need async validation
  if (options.checkExists) {
    return z.string()
      .min(1, 'ObjectId is required')
      .transform((id) => cleanObjectId(id))
      .refine(
        async (id) => {
          const result = await validateObjectId(id, options);
          return result.isValid;
        },
        (id) => {
          // This will be called only if refine fails
          // We need to run sync validation to get error details
          const result = validateObjectId(id, { ...options, checkExists: false });
          return {
            message: result.message || 'Invalid ObjectId',
            code: result.error || 'INVALID_OBJECTID'
          };
        }
      );
  }
  
  // Synchronous validation
  return z.string()
    .min(1, 'ObjectId is required')
    .transform((id) => cleanObjectId(id))
    .refine(
      (id) => validateObjectId(id, options).isValid,
      (id) => {
        const result = validateObjectId(id, options);
        return {
          message: result.message || 'Invalid ObjectId',
          code: result.error || 'INVALID_OBJECTID'
        };
      }
    )
    .transform((id) => {
      const result = validateObjectId(id, options);
      return result.normalized || id;
    });
}

// ─── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  // Main validation functions
  validateObjectId,
  normalizeObjectId,
  
  // Utility functions
  cleanObjectId,
  isValidObjectId,
  isMongooseObjectId,
  getObjectIdTimestamp,
  getObjectIdAge,
  compareObjectIds,
  validateObjectIdsBatch,
  
  // Reference integrity functions
  validateReferenceIntegrity,
  createModelExistenceChecker,
  performExistenceCheck,
  
  // Internal validation functions (for testing)
  validateObjectIdFormat,
  validateObjectIdTimestamp,
  extractTimestamp,
  
  // Zod integration
  createObjectIdSchema,
  
  // Constants and configuration
  OBJECTID_ERROR_CODES,
  OBJECTID_ERROR_MESSAGES,
  
  // Patterns for external use
  patterns: {
    OBJECTID_PATTERN,
    OBJECTID_PATTERN_STRICT
  }
};
