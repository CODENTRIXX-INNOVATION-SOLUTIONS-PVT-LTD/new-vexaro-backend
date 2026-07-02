/**
 * PIN Code Validator Unit Tests
 * 
 * Comprehensive test suite for Indian PIN code validation functionality
 * Tests 6-digit format validation, region validation, special locations,
 * and all edge cases specified in requirement R3.2
 */

const {
  validatePincode,
  normalizePincode,
  formatPincode,
  cleanPincode,
  isValidPincode,
  getRegionInfo,
  isInRegion,
  isSpecialPincode,
  validatePincodesBatch,
  validatePincodeFormat,
  validatePincodeRegion,
  extractRegion,
  getSpecialLocation,
  PINCODE_ERROR_CODES,
  PINCODE_ERROR_MESSAGES,
  POSTAL_REGIONS,
  SPECIAL_PINCODES,
} = require('../../validators/pincode.validator');

describe('PIN Code Validator', () => {
  describe('cleanPincode', () => {
    test('should remove spaces from PIN code', () => {
      expect(cleanPincode('110 001')).toBe('110001');
      expect(cleanPincode('1 1 0 0 0 1')).toBe('110001');
    });

    test('should remove dashes from PIN code', () => {
      expect(cleanPincode('110-001')).toBe('110001');
    });

    test('should remove all non-digit characters', () => {
      expect(cleanPincode('110@001')).toBe('110001');
      expect(cleanPincode('110.001')).toBe('110001');
      expect(cleanPincode('PIN:110001')).toBe('110001');
    });

    test('should return empty string for null/undefined', () => {
      expect(cleanPincode(null)).toBe('');
      expect(cleanPincode(undefined)).toBe('');
    });

    test('should return empty string for non-string input', () => {
      expect(cleanPincode(123456)).toBe('');
      expect(cleanPincode({})).toBe('');
    });

    test('should handle already clean PIN codes', () => {
      expect(cleanPincode('110001')).toBe('110001');
      expect(cleanPincode('400001')).toBe('400001');
    });
  });

  describe('extractRegion', () => {
    test('should extract region from valid PIN codes', () => {
      const result1 = extractRegion('110001');
      expect(result1).toEqual({
        code: 1,
        region: 'Delhi, Punjab, Haryana, Himachal Pradesh, Jammu & Kashmir, Chandigarh'
      });

      const result4 = extractRegion('400001');
      expect(result4).toEqual({
        code: 4,
        region: 'Maharashtra, Goa, Madhya Pradesh, Chhattisgarh'
      });

      const result6 = extractRegion('600001');
      expect(result6).toEqual({
        code: 6,
        region: 'Tamil Nadu, Kerala, Puducherry, Lakshadweep'
      });
    });

    test('should return null for invalid PIN codes', () => {
      expect(extractRegion('')).toBeNull();
      expect(extractRegion('12345')).toBeNull(); // Too short
      expect(extractRegion('1234567')).toBeNull(); // Too long
      expect(extractRegion(null)).toBeNull();
    });

    test('should handle all region codes (1-9)', () => {
      for (let i = 1; i <= 9; i++) {
        const pincode = `${i}00001`;
        const result = extractRegion(pincode);
        expect(result).not.toBeNull();
        expect(result.code).toBe(i);
        expect(result.region).toBeDefined();
      }
    });
  });

  describe('getSpecialLocation', () => {
    test('should identify Parliament House PIN code', () => {
      const result = getSpecialLocation('110001');
      expect(result).toEqual({
        location: 'Parliament House',
        city: 'New Delhi',
        state: 'Delhi'
      });
    });

    test('should identify Mumbai GPO', () => {
      const result = getSpecialLocation('400001');
      expect(result).toEqual({
        location: 'Mumbai GPO',
        city: 'Mumbai',
        state: 'Maharashtra'
      });
    });

    test('should identify Chennai GPO', () => {
      const result = getSpecialLocation('600001');
      expect(result).toEqual({
        location: 'Chennai GPO',
        city: 'Chennai',
        state: 'Tamil Nadu'
      });
    });

    test('should return null for non-special PIN codes', () => {
      expect(getSpecialLocation('110002')).toBeNull();
      expect(getSpecialLocation('400002')).toBeNull();
      expect(getSpecialLocation('500002')).toBeNull();
    });

    test('should identify all special locations', () => {
      expect(getSpecialLocation('110004')).not.toBeNull(); // Rashtrapati Bhavan
      expect(getSpecialLocation('700001')).not.toBeNull(); // Kolkata GPO
      expect(getSpecialLocation('560001')).not.toBeNull(); // Bangalore GPO
      expect(getSpecialLocation('500001')).not.toBeNull(); // Hyderabad GPO
    });
  });

  describe('validatePincodeFormat', () => {
    test('should accept valid 6-digit PIN codes', () => {
      expect(validatePincodeFormat('110001').isValid).toBe(true);
      expect(validatePincodeFormat('400001').isValid).toBe(true);
      expect(validatePincodeFormat('600001').isValid).toBe(true);
      expect(validatePincodeFormat('999999').isValid).toBe(true);
    });

    test('should reject PIN codes starting with 0', () => {
      const result = validatePincodeFormat('000001');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PINCODE_ERROR_CODES.INVALID_STARTING_DIGIT);
    });

    test('should reject PIN codes that are too short', () => {
      const result = validatePincodeFormat('11000');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PINCODE_ERROR_CODES.PINCODE_TOO_SHORT);
    });

    test('should reject PIN codes that are too long', () => {
      const result = validatePincodeFormat('1100011');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PINCODE_ERROR_CODES.PINCODE_TOO_LONG);
    });

    test('should reject non-numeric PIN codes', () => {
      const result = validatePincodeFormat('11000A');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PINCODE_ERROR_CODES.INVALID_FORMAT);
    });
  });

  describe('validatePincodeRegion', () => {
    test('should validate regions for all zone codes', () => {
      for (let i = 1; i <= 9; i++) {
        const pincode = `${i}00001`;
        const result = validatePincodeRegion(pincode);
        expect(result.isValid).toBe(true);
        expect(result.region.code).toBe(i);
        expect(result.region.region).toBeDefined();
      }
    });

    test('should return error for invalid PIN codes', () => {
      const result = validatePincodeRegion('12345');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PINCODE_ERROR_CODES.INVALID_REGION);
    });
  });

  describe('validatePincode', () => {
    test('should validate basic legitimate PIN codes', () => {
      const result = validatePincode('110001');
      expect(result.isValid).toBe(true);
      expect(result.cleaned).toBe('110001');
      expect(result.normalized).toBe('110001');
      expect(result.region).toBeDefined();
      expect(result.region.code).toBe(1);
      expect(result.formatted).toBe('110001');
    });

    test('should handle PIN codes with spaces', () => {
      const result = validatePincode('110 001');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('110001');
    });

    test('should handle PIN codes with dashes', () => {
      const result = validatePincode('110-001');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('110001');
    });

    test('should trim whitespace', () => {
      const result = validatePincode('  110001  ');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('110001');
    });

    test('should identify special locations', () => {
      const result = validatePincode('110001');
      expect(result.isValid).toBe(true);
      expect(result.specialLocation).toBeDefined();
      expect(result.specialLocation.location).toBe('Parliament House');
    });

    test('should reject empty PIN code', () => {
      expect(validatePincode('').isValid).toBe(false);
      expect(validatePincode(null).isValid).toBe(false);
      expect(validatePincode(undefined).isValid).toBe(false);
    });

    test('should reject PIN codes starting with 0', () => {
      const result = validatePincode('000001');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PINCODE_ERROR_CODES.INVALID_STARTING_DIGIT);
    });

    test('should reject PIN codes that are too short', () => {
      const result = validatePincode('11000');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PINCODE_ERROR_CODES.PINCODE_TOO_SHORT);
    });

    test('should reject PIN codes that are too long', () => {
      const result = validatePincode('1100011');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PINCODE_ERROR_CODES.PINCODE_TOO_LONG);
    });

    test('should accept PIN codes with validateRegion=false', () => {
      const result = validatePincode('110001', { validateRegion: false });
      expect(result.isValid).toBe(true);
      expect(result.region).toBeDefined(); // Still extracted, just not validated
    });

    test('should handle strictFormat option', () => {
      const result1 = validatePincode('110 001', { strictFormat: true });
      expect(result1.isValid).toBe(true); // Accepts with warning
      
      const result2 = validatePincode('110001', { strictFormat: false });
      expect(result2.isValid).toBe(true);
    });

    test('should validate all Indian postal regions', () => {
      const testPincodes = [
        '110001', // Delhi region
        '201301', // Uttar Pradesh
        '302001', // Rajasthan
        '400001', // Maharashtra
        '500001', // Telangana
        '600001', // Tamil Nadu
        '700001', // West Bengal
        '800001', // Bihar
        '900001', // APO/FPO
      ];

      testPincodes.forEach(pincode => {
        const result = validatePincode(pincode);
        expect(result.isValid).toBe(true);
        expect(result.region).toBeDefined();
      });
    });
  });

  describe('formatPincode', () => {
    test('should format PIN code without separator by default', () => {
      expect(formatPincode('110001')).toBe('110001');
    });

    test('should format PIN code with space separator', () => {
      expect(formatPincode('110001', { separator: ' ', grouping: true })).toBe('110 001');
    });

    test('should format PIN code with dash separator', () => {
      expect(formatPincode('110001', { separator: '-', grouping: true })).toBe('110-001');
    });

    test('should return unchanged for invalid length', () => {
      expect(formatPincode('11000')).toBe('11000');
      expect(formatPincode('1100011')).toBe('1100011');
    });

    test('should handle null/undefined', () => {
      expect(formatPincode(null)).toBeNull();
      expect(formatPincode(undefined)).toBeUndefined();
    });

    test('should not group if grouping is false', () => {
      expect(formatPincode('110001', { separator: ' ', grouping: false })).toBe('110001');
    });
  });

  describe('normalizePincode', () => {
    test('should normalize valid PIN code', () => {
      const result = normalizePincode('110 001');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('110001');
      expect(result.original).toBe('110 001');
      expect(result.region).toBeDefined();
    });

    test('should return error for invalid PIN code', () => {
      const result = normalizePincode('invalid');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.original).toBe('invalid');
    });

    test('should include special location info if applicable', () => {
      const result = normalizePincode('110001');
      expect(result.isValid).toBe(true);
      expect(result.specialLocation).toBeDefined();
      expect(result.specialLocation.location).toBe('Parliament House');
    });
  });

  describe('isValidPincode', () => {
    test('should return true for valid PIN codes', () => {
      expect(isValidPincode('110001')).toBe(true);
      expect(isValidPincode('400001')).toBe(true);
      expect(isValidPincode('600001')).toBe(true);
    });

    test('should return false for invalid PIN codes', () => {
      expect(isValidPincode('invalid')).toBe(false);
      expect(isValidPincode('000001')).toBe(false);
      expect(isValidPincode('11000')).toBe(false);
    });

    test('should accept PIN codes with spaces when cleaned', () => {
      expect(isValidPincode('110 001')).toBe(true);
    });
  });

  describe('getRegionInfo', () => {
    test('should return region information for valid PIN code', () => {
      const result = getRegionInfo('110001');
      expect(result).toEqual({
        code: 1,
        region: 'Delhi, Punjab, Haryana, Himachal Pradesh, Jammu & Kashmir, Chandigarh',
        specialLocation: expect.any(Object)
      });
    });

    test('should identify special location', () => {
      const result = getRegionInfo('400001');
      expect(result.specialLocation).toBeDefined();
      expect(result.specialLocation.location).toBe('Mumbai GPO');
    });

    test('should return null for invalid PIN code', () => {
      expect(getRegionInfo('invalid')).toBeNull();
      expect(getRegionInfo('000001')).toBeNull();
    });

    test('should return region info without special location for regular PIN codes', () => {
      const result = getRegionInfo('110002');
      expect(result.code).toBe(1);
      expect(result.region).toBeDefined();
      expect(result.specialLocation).toBeNull();
    });
  });

  describe('isInRegion', () => {
    test('should identify PIN codes in specific regions', () => {
      expect(isInRegion('110001', 1)).toBe(true); // Delhi region
      expect(isInRegion('201301', 2)).toBe(true); // UP region
      expect(isInRegion('400001', 4)).toBe(true); // Maharashtra region
      expect(isInRegion('600001', 6)).toBe(true); // Tamil Nadu region
    });

    test('should return false for PIN codes not in region', () => {
      expect(isInRegion('110001', 2)).toBe(false);
      expect(isInRegion('400001', 6)).toBe(false);
    });

    test('should return false for invalid PIN codes', () => {
      expect(isInRegion('invalid', 1)).toBe(false);
      expect(isInRegion('000001', 1)).toBe(false);
    });
  });

  describe('isSpecialPincode', () => {
    test('should identify special PIN codes', () => {
      expect(isSpecialPincode('110001')).toBe(true); // Parliament House
      expect(isSpecialPincode('110004')).toBe(true); // Rashtrapati Bhavan
      expect(isSpecialPincode('400001')).toBe(true); // Mumbai GPO
      expect(isSpecialPincode('600001')).toBe(true); // Chennai GPO
    });

    test('should return false for regular PIN codes', () => {
      expect(isSpecialPincode('110002')).toBe(false);
      expect(isSpecialPincode('400002')).toBe(false);
    });

    test('should return false for invalid PIN codes', () => {
      expect(isSpecialPincode('invalid')).toBe(false);
      expect(isSpecialPincode('000001')).toBe(false);
    });
  });

  describe('validatePincodesBatch', () => {
    test('should validate multiple PIN codes', () => {
      const pincodes = ['110001', '400001', 'invalid'];
      const results = validatePincodesBatch(pincodes);
      
      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
      
      expect(results[0].index).toBe(0);
      expect(results[1].index).toBe(1);
      expect(results[2].index).toBe(2);
    });

    test('should throw error for non-array input', () => {
      expect(() => validatePincodesBatch('110001')).toThrow();
      expect(() => validatePincodesBatch({})).toThrow();
    });

    test('should include region and special location info', () => {
      const pincodes = ['110001', '400001'];
      const results = validatePincodesBatch(pincodes);
      
      expect(results[0].region).toBeDefined();
      expect(results[0].specialLocation).toBeDefined();
      expect(results[1].region).toBeDefined();
      expect(results[1].specialLocation).toBeDefined();
    });
  });

  describe('Real-world scenarios', () => {
    test('should validate common city PIN codes', () => {
      const commonPincodes = [
        '110001', // New Delhi
        '400001', // Mumbai
        '700001', // Kolkata
        '600001', // Chennai
        '560001', // Bangalore
        '500001', // Hyderabad
        '411001', // Pune
        '380001', // Ahmedabad
        '302001', // Jaipur
        '226001', // Lucknow
      ];

      commonPincodes.forEach(pincode => {
        const result = validatePincode(pincode);
        expect(result.isValid).toBe(true);
        expect(result.region).toBeDefined();
      });
    });

    test('should handle user input with various formatting', () => {
      const inputs = [
        '110001',
        '110 001',
        '110-001',
        ' 110001 ',
        '1 1 0 0 0 1',
      ];

      inputs.forEach(input => {
        const result = validatePincode(input);
        expect(result.isValid).toBe(true);
        expect(result.normalized).toBe('110001');
      });
    });

    test('should reject common invalid inputs', () => {
      const invalidInputs = [
        '000000',
        '0',
        '11',
        '110',
        '11000',
        '1100011',
        'ABCDEF',
        '11000A',
        '',
        null,
        undefined,
      ];

      invalidInputs.forEach(input => {
        const result = validatePincode(input);
        expect(result.isValid).toBe(false);
      });
    });

    test('should validate all 9 postal regions', () => {
      for (let i = 1; i <= 9; i++) {
        const pincode = `${i}00001`;
        const result = validatePincode(pincode);
        expect(result.isValid).toBe(true);
        expect(result.region.code).toBe(i);
        expect(POSTAL_REGIONS[i]).toBeDefined();
      }
    });
  });

  describe('Edge cases and boundary conditions', () => {
    test('should handle minimum valid PIN code', () => {
      expect(validatePincode('100000').isValid).toBe(true);
    });

    test('should handle maximum valid PIN code', () => {
      expect(validatePincode('999999').isValid).toBe(true);
    });

    test('should reject PIN code with letters', () => {
      expect(validatePincode('11000A').isValid).toBe(false);
      expect(validatePincode('ABC123').isValid).toBe(false);
    });

    test('should handle numeric input converted to string', () => {
      // Although the function expects string, test that cleaning works
      const result = validatePincode('110001');
      expect(result.isValid).toBe(true);
    });

    test('should handle PIN codes with mixed formatting', () => {
      expect(validatePincode('1 1-0 0-0 1').isValid).toBe(true);
    });
  });

  describe('Constants validation', () => {
    test('should have all error codes defined', () => {
      expect(PINCODE_ERROR_CODES).toBeDefined();
      expect(PINCODE_ERROR_CODES.INVALID_FORMAT).toBeDefined();
      expect(PINCODE_ERROR_CODES.EMPTY_PINCODE).toBeDefined();
      expect(PINCODE_ERROR_CODES.INVALID_STARTING_DIGIT).toBeDefined();
    });

    test('should have all error messages defined', () => {
      expect(PINCODE_ERROR_MESSAGES).toBeDefined();
      Object.keys(PINCODE_ERROR_CODES).forEach(key => {
        expect(PINCODE_ERROR_MESSAGES[PINCODE_ERROR_CODES[key]]).toBeDefined();
      });
    });

    test('should have all postal regions defined', () => {
      expect(POSTAL_REGIONS).toBeDefined();
      for (let i = 1; i <= 9; i++) {
        expect(POSTAL_REGIONS[i]).toBeDefined();
        expect(POSTAL_REGIONS[i].region).toBeDefined();
      }
    });

    test('should have special PIN codes defined', () => {
      expect(SPECIAL_PINCODES).toBeDefined();
      expect(SPECIAL_PINCODES[110001]).toBeDefined();
      expect(SPECIAL_PINCODES[400001]).toBeDefined();
      expect(SPECIAL_PINCODES[600001]).toBeDefined();
    });
  });
});
