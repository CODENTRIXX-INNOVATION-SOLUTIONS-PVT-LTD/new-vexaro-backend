'use strict';

/**
 * Unit Tests for ObjectId Validator
 * 
 * Comprehensive test suite for MongoDB ObjectId validation including:
 * - Format validation
 * - Timestamp extraction
 * - Reference integrity
 * - Error handling
 * - Edge cases
 * 
 * Requirements: R3.5, R10.3
 */

const {
  validateObjectId,
  normalizeObjectId,
  isValidObjectId,
  getObjectIdTimestamp,
  getObjectIdAge,
  compareObjectIds,
  validateObjectIdsBatch,
  validateObjectIdFormat,
  validateObjectIdTimestamp,
  extractTimestamp,
  cleanObjectId,
  isMongooseObjectId,
  createModelExistenceChecker,
  validateReferenceIntegrity,
  OBJECTID_ERROR_CODES,
  OBJECTID_ERROR_MESSAGES,
} = require('../../validators/objectid.validator');

describe('ObjectId Validator - Format Validation', () => {
  describe('validateObjectId - Basic format validation', () => {
    test('should validate a valid 24 character hex ObjectId', () => {
      const result = validateObjectId('507f1f77bcf86cd799439011');
      
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('507f1f77bcf86cd799439011');
      expect(result.cleaned).toBe('507f1f77bcf86cd799439011');
    });
    
    test('should validate uppercase ObjectId and normalize to lowercase', () => {
      const result = validateObjectId('507F1F77BCF86CD799439011');
      
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('507f1f77bcf86cd799439011');
    });
    
    test('should validate mixed case ObjectId', () => {
      const result = validateObjectId('507f1F77BcF86cD799439011');
      
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('507f1f77bcf86cd799439011');
    });
    
    test('should reject ObjectId with invalid characters', () => {
      const result = validateObjectId('507f1f77bcf86cd79943901g'); // 'g' is invalid
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(OBJECTID_ERROR_CODES.INVALID_CHARACTERS);
    });
    
    test('should reject ObjectId that is too short', () => {
      const result = validateObjectId('507f1f77bcf86cd7994390');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(OBJECTID_ERROR_CODES.OBJECTID_TOO_SHORT);
    });
    
    test('should reject ObjectId that is too long', () => {
      const result = validateObjectId('507f1f77bcf86cd799439011abc');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(OBJECTID_ERROR_CODES.OBJECTID_TOO_LONG);
    });
    
    test('should reject empty ObjectId', () => {
      const result = validateObjectId('');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(OBJECTID_ERROR_CODES.EMPTY_OBJECTID);
    });
    
    test('should reject null ObjectId', () => {
      const result = validateObjectId(null);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(OBJECTID_ERROR_CODES.EMPTY_OBJECTID);
    });
    
    test('should reject undefined ObjectId', () => {
      const result = validateObjectId(undefined);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(OBJECTID_ERROR_CODES.EMPTY_OBJECTID);
    });
  });
  
  describe('validateObjectIdFormat - Internal format validation', () => {
    test('should validate correct format', () => {
      const result = validateObjectIdFormat('507f1f77bcf86cd799439011');
      
      expect(result.isValid).toBe(true);
    });
    
    test('should enforce strict lowercase when strict option is true', () => {
      const result = validateObjectIdFormat('507F1F77BCF86CD799439011', { strict: true });
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(OBJECTID_ERROR_CODES.INVALID_CHARACTERS);
    });
    
    test('should allow mixed case when strict is false', () => {
      const result = validateObjectIdFormat('507F1F77BCF86CD799439011', { strict: false });
      
      expect(result.isValid).toBe(true);
    });
  });
  
  describe('cleanObjectId - Input sanitization', () => {
    test('should trim whitespace from ObjectId', () => {
      const cleaned = cleanObjectId('  507f1f77bcf86cd799439011  ');
      
      expect(cleaned).toBe('507f1f77bcf86cd799439011');
    });
    
    test('should convert to lowercase', () => {
      const cleaned = cleanObjectId('507F1F77BCF86CD799439011');
      
      expect(cleaned).toBe('507f1f77bcf86cd799439011');
    });
    
    test('should handle Mongoose ObjectId instance', () => {
      const mockObjectId = {
        toString: () => '507f1f77bcf86cd799439011',
        toHexString: () => '507f1f77bcf86cd799439011',
      };
      
      const cleaned = cleanObjectId(mockObjectId);
      
      expect(cleaned).toBe('507f1f77bcf86cd799439011');
    });
    
    test('should return empty string for invalid input', () => {
      expect(cleanObjectId(123)).toBe('');
      expect(cleanObjectId(null)).toBe('');
      expect(cleanObjectId(undefined)).toBe('');
      expect(cleanObjectId({})).toBe('');
    });
  });
});

describe('ObjectId Validator - Timestamp Extraction', () => {
  describe('extractTimestamp - Timestamp extraction from ObjectId', () => {
    test('should extract valid timestamp from ObjectId', () => {
      // ObjectId created on Jan 1, 2023
      const objectId = '63b1b5c0bcf86cd799439011';
      const timestamp = extractTimestamp(objectId);
      
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getFullYear()).toBe(2023);
    });
    
    test('should return null for invalid ObjectId', () => {
      expect(extractTimestamp('invalid')).toBeNull();
      expect(extractTimestamp('')).toBeNull();
      expect(extractTimestamp(null)).toBeNull();
    });
    
    test('should extract timestamp from very old ObjectId (MongoDB epoch)', () => {
      // ObjectId from 2010
      const objectId = '4c4b1476238d3b4dd5000001';
      const timestamp = extractTimestamp(objectId);
      
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getFullYear()).toBe(2010);
    });
  });
  
  describe('validateObjectIdTimestamp - Timestamp validation', () => {
    test('should validate reasonable timestamp', () => {
      // Recent ObjectId
      const objectId = '63b1b5c0bcf86cd799439011';
      const result = validateObjectIdTimestamp(objectId);
      
      expect(result.isValid).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
    });
    
    test('should reject timestamp before MongoDB existed (2009)', () => {
      // Timestamp from year 2000 (before MongoDB)
      const objectId = '386d4380000000000000000';
      const result = validateObjectIdTimestamp(objectId);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(OBJECTID_ERROR_CODES.INVALID_TIMESTAMP);
    });
    
    test('should reject future timestamps', () => {
      // Create ObjectId with timestamp 1 year in future
      const futureTimestamp = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);
      const objectId = futureTimestamp.toString(16).padEnd(24, '0');
      const result = validateObjectIdTimestamp(objectId);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(OBJECTID_ERROR_CODES.FUTURE_TIMESTAMP);
    });
    
    test('should accept timestamp within 5 minute buffer', () => {
      // Current timestamp (should be valid even with slight clock skew)
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const objectId = currentTimestamp.toString(16).padEnd(24, '0');
      const result = validateObjectIdTimestamp(objectId);
      
      expect(result.isValid).toBe(true);
    });
  });
  
  describe('getObjectIdTimestamp - Public timestamp getter', () => {
    test('should get timestamp from valid ObjectId', () => {
      const objectId = '63b1b5c0bcf86cd799439011';
      const timestamp = getObjectIdTimestamp(objectId);
      
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getFullYear()).toBe(2023);
    });
    
    test('should handle uppercase ObjectId', () => {
      const objectId = '63B1B5C0BCF86CD799439011';
      const timestamp = getObjectIdTimestamp(objectId);
      
      expect(timestamp).toBeInstanceOf(Date);
    });
    
    test('should return null for invalid ObjectId', () => {
      expect(getObjectIdTimestamp('invalid')).toBeNull();
      expect(getObjectIdTimestamp('')).toBeNull();
    });
  });
  
  describe('getObjectIdAge - Age calculation', () => {
    test('should calculate age of recent ObjectId', () => {
      // Create ObjectId from 1 hour ago
      const hourAgo = Math.floor((Date.now() - 3600000) / 1000);
      const objectId = hourAgo.toString(16).padEnd(24, '0');
      const age = getObjectIdAge(objectId);
      
      expect(age).toBeGreaterThan(3500000); // ~1 hour in ms
      expect(age).toBeLessThan(3700000);
    });
    
    test('should return null for invalid ObjectId', () => {
      expect(getObjectIdAge('invalid')).toBeNull();
    });
  });
});

describe('ObjectId Validator - Mongoose Integration', () => {
  describe('isMongooseObjectId - Instance checking', () => {
    test('should identify Mongoose ObjectId instance', () => {
      const mockObjectId = {
        constructor: { name: 'ObjectId' },
        toString: () => '507f1f77bcf86cd799439011',
        toHexString: () => '507f1f77bcf86cd799439011',
      };
      
      expect(isMongooseObjectId(mockObjectId)).toBe(true);
    });
    
    test('should reject plain string', () => {
      expect(isMongooseObjectId('507f1f77bcf86cd799439011')).toBe(false);
    });
    
    test('should reject plain object', () => {
      expect(isMongooseObjectId({})).toBe(false);
    });
    
    test('should reject null and undefined', () => {
      expect(isMongooseObjectId(null)).toBe(false);
      expect(isMongooseObjectId(undefined)).toBe(false);
    });
  });
  
  describe('validateObjectId with Mongoose instance', () => {
    test('should validate Mongoose ObjectId instance', () => {
      const mockObjectId = {
        constructor: { name: 'ObjectId' },
        toString: () => '507f1f77bcf86cd799439011',
        toHexString: () => '507f1f77bcf86cd799439011',
      };
      
      const result = validateObjectId(mockObjectId);
      
      expect(result.isValid).toBe(true);
      expect(result.isMongooseInstance).toBe(true);
      expect(result.normalized).toBe('507f1f77bcf86cd799439011');
    });
  });
});

describe('ObjectId Validator - Utility Functions', () => {
  describe('isValidObjectId - Quick validation check', () => {
    test('should return true for valid ObjectId', () => {
      expect(isValidObjectId('507f1f77bcf86cd799439011')).toBe(true);
    });
    
    test('should return false for invalid ObjectId', () => {
      expect(isValidObjectId('invalid')).toBe(false);
      expect(isValidObjectId('')).toBe(false);
      expect(isValidObjectId(null)).toBe(false);
    });
  });
  
  describe('normalizeObjectId - Normalization function', () => {
    test('should normalize valid ObjectId', () => {
      const result = normalizeObjectId('507F1F77BCF86CD799439011');
      
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('507f1f77bcf86cd799439011');
    });
    
    test('should return error for invalid ObjectId', () => {
      const result = normalizeObjectId('invalid');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
  
  describe('compareObjectIds - Comparison function', () => {
    test('should compare ObjectIds lexicographically', () => {
      const id1 = '507f1f77bcf86cd799439011';
      const id2 = '507f1f77bcf86cd799439012';
      
      expect(compareObjectIds(id1, id2)).toBeLessThan(0);
      expect(compareObjectIds(id2, id1)).toBeGreaterThan(0);
      expect(compareObjectIds(id1, id1)).toBe(0);
    });
    
    test('should handle case differences', () => {
      const id1 = '507f1f77bcf86cd799439011';
      const id2 = '507F1F77BCF86CD799439011';
      
      expect(compareObjectIds(id1, id2)).toBe(0);
    });
    
    test('should return 0 for invalid ObjectIds', () => {
      expect(compareObjectIds('invalid', 'invalid')).toBe(0);
    });
  });
  
  describe('validateObjectIdsBatch - Batch validation', () => {
    test('should validate multiple ObjectIds', () => {
      const objectIds = [
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
        '507f1f77bcf86cd799439013',
      ];
      
      const results = validateObjectIdsBatch(objectIds);
      
      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(true);
    });
    
    test('should identify invalid ObjectIds in batch', () => {
      const objectIds = [
        '507f1f77bcf86cd799439011',
        'invalid',
        '507f1f77bcf86cd799439013',
      ];
      
      const results = validateObjectIdsBatch(objectIds);
      
      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[2].isValid).toBe(true);
    });
    
    test('should throw error for non-array input', () => {
      expect(() => validateObjectIdsBatch('not-an-array')).toThrow();
    });
  });
});

describe('ObjectId Validator - Reference Integrity', () => {
  describe('createModelExistenceChecker', () => {
    test('should create existence checker from mock model', () => {
      const mockModel = {
        exists: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011' }),
      };
      
      const checker = createModelExistenceChecker(mockModel);
      
      expect(typeof checker).toBe('function');
    });
    
    test('should throw error for invalid model', () => {
      expect(() => createModelExistenceChecker(null)).toThrow();
      expect(() => createModelExistenceChecker({})).toThrow();
    });
  });
  
  describe('validateReferenceIntegrity - Async batch validation', () => {
    test('should validate all references exist', async () => {
      const mockExistsChecker = jest.fn().mockResolvedValue(true);
      
      const objectIds = [
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
      ];
      
      const result = await validateReferenceIntegrity(objectIds, {
        existsChecker: mockExistsChecker,
      });
      
      expect(result.isValid).toBe(true);
      expect(result.total).toBe(2);
      expect(result.valid).toBe(2);
      expect(result.invalid).toBe(0);
    });
    
    test('should detect missing references', async () => {
      const mockExistsChecker = jest.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      
      const objectIds = [
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
      ];
      
      const result = await validateReferenceIntegrity(objectIds, {
        existsChecker: mockExistsChecker,
      });
      
      expect(result.isValid).toBe(false);
      expect(result.valid).toBe(1);
      expect(result.invalid).toBe(1);
      expect(result.invalidReferences).toHaveLength(1);
    });
    
    test('should throw error for non-array input', async () => {
      await expect(validateReferenceIntegrity('not-an-array')).rejects.toThrow();
    });
  });
  
  describe('validateObjectId with existence checking', () => {
    test('should validate existence with custom checker', async () => {
      const mockExistsChecker = jest.fn().mockResolvedValue(true);
      
      const result = await validateObjectId('507f1f77bcf86cd799439011', {
        checkExists: true,
        existsChecker: mockExistsChecker,
      });
      
      expect(result.isValid).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.existsCheckPerformed).toBe(true);
      expect(mockExistsChecker).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });
    
    test('should detect non-existent reference', async () => {
      const mockExistsChecker = jest.fn().mockResolvedValue(false);
      
      const result = await validateObjectId('507f1f77bcf86cd799439011', {
        checkExists: true,
        existsChecker: mockExistsChecker,
      });
      
      expect(result.isValid).toBe(false);
      expect(result.exists).toBe(false);
      expect(result.error).toBe(OBJECTID_ERROR_CODES.NOT_FOUND);
    });
    
    test('should handle existence check errors', async () => {
      const mockExistsChecker = jest.fn().mockRejectedValue(new Error('Database error'));
      
      const result = await validateObjectId('507f1f77bcf86cd799439011', {
        checkExists: true,
        existsChecker: mockExistsChecker,
      });
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(OBJECTID_ERROR_CODES.REFERENCE_INTEGRITY_FAILED);
      expect(result.checkError).toBe('Database error');
    });
  });
});

describe('ObjectId Validator - Edge Cases', () => {
  test('should handle ObjectId with all zeros', () => {
    const result = validateObjectId('000000000000000000000000');
    
    expect(result.isValid).toBe(false); // Should fail timestamp validation (before MongoDB epoch)
  });
  
  test('should handle ObjectId with all f characters', () => {
    const result = validateObjectId('ffffffffffffffffffffffff');
    
    expect(result.isValid).toBe(false); // Should fail timestamp validation (future timestamp)
  });
  
  test('should handle ObjectId with whitespace', () => {
    const result = validateObjectId('  507f1f77bcf86cd799439011  ');
    
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe('507f1f77bcf86cd799439011');
  });
  
  test('should handle ObjectId with special characters', () => {
    const result = validateObjectId('507f-1f77-bcf8-6cd7-9943-9011');
    
    expect(result.isValid).toBe(false);
  });
  
  test('should disable timestamp validation when requested', () => {
    // Future timestamp that would normally fail
    const futureTimestamp = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);
    const objectId = futureTimestamp.toString(16).padEnd(24, '0');
    
    const result = validateObjectId(objectId, { validateTimestamp: false });
    
    expect(result.isValid).toBe(true); // Should pass without timestamp validation
    expect(result.timestamp).toBeDefined(); // Timestamp still extracted
  });
});

describe('ObjectId Validator - Error Messages', () => {
  test('should provide error codes for all error types', () => {
    expect(OBJECTID_ERROR_CODES.INVALID_FORMAT).toBeDefined();
    expect(OBJECTID_ERROR_CODES.INVALID_LENGTH).toBeDefined();
    expect(OBJECTID_ERROR_CODES.EMPTY_OBJECTID).toBeDefined();
    expect(OBJECTID_ERROR_CODES.INVALID_CHARACTERS).toBeDefined();
    expect(OBJECTID_ERROR_CODES.INVALID_TIMESTAMP).toBeDefined();
    expect(OBJECTID_ERROR_CODES.FUTURE_TIMESTAMP).toBeDefined();
    expect(OBJECTID_ERROR_CODES.NOT_FOUND).toBeDefined();
    expect(OBJECTID_ERROR_CODES.REFERENCE_INTEGRITY_FAILED).toBeDefined();
  });
  
  test('should provide error messages for all error codes', () => {
    Object.values(OBJECTID_ERROR_CODES).forEach(code => {
      expect(OBJECTID_ERROR_MESSAGES[code]).toBeDefined();
      expect(typeof OBJECTID_ERROR_MESSAGES[code]).toBe('string');
    });
  });
  
  test('should include descriptive error messages', () => {
    const result = validateObjectId('invalid');
    
    expect(result.message).toBeDefined();
    expect(result.message.length).toBeGreaterThan(0);
  });
});
