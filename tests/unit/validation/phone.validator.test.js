'use strict';

/**
 * Phone Validator Test Suite
 * 
 * Comprehensive tests for the phone number validation functionality
 * covering Indian mobile numbers and international formats.
 * 
 * @module PhoneValidatorTests
 */

const {
  validatePhone,
  normalizePhone,
  formatPhone,
  cleanPhoneNumber,
  isIndianMobile,
  isInternationalPhone,
  getCountryInfo,
  validatePhonesBatch,
  formatIndianMobile,
  formatInternationalPhone,
  createPhoneSchema,
  PHONE_ERROR_CODES
} = require('../../../src/validation/validators/phone.validator');

describe('Phone Validator', () => {
  
  // ─── Indian Mobile Number Validation Tests ─────────────────────────────────────
  
  describe('validatePhone - Indian Mobile Numbers', () => {
    
    test('should validate 10-digit Indian mobile numbers starting with 6', () => {
      const result = validatePhone('6123456789');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('indian_mobile');
      expect(result.countryCode).toBe(91);
      expect(result.nationalNumber).toBe('6123456789');
      expect(result.normalized).toBe('+916123456789');
    });
    
    test('should validate 10-digit Indian mobile numbers starting with 7', () => {
      const result = validatePhone('7987654321');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('indian_mobile');
      expect(result.normalized).toBe('+917987654321');
    });
    
    test('should validate 10-digit Indian mobile numbers starting with 8', () => {
      const result = validatePhone('8555666777');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('indian_mobile');
      expect(result.normalized).toBe('+918555666777');
    });
    
    test('should validate 10-digit Indian mobile numbers starting with 9', () => {
      const result = validatePhone('9876543210');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('indian_mobile');
      expect(result.normalized).toBe('+919876543210');
    });
    
    test('should validate Indian mobile with +91 country code', () => {
      const result = validatePhone('+919876543210');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('indian_mobile');
      expect(result.normalized).toBe('+919876543210');
    });
    
    test('should validate Indian mobile with 91 prefix', () => {
      const result = validatePhone('919876543210');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('indian_mobile');
      expect(result.normalized).toBe('+919876543210');
    });
    
    test('should validate Indian mobile with 0091 prefix', () => {
      const result = validatePhone('00919876543210');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('indian_mobile');
      expect(result.normalized).toBe('+919876543210');
    });
    
    test('should reject Indian mobile starting with invalid digits (0-5)', () => {
      const invalidNumbers = ['0123456789', '1234567890', '2345678901', '3456789012', '4567890123', '5678901234'];
      
      invalidNumbers.forEach(number => {
        const result = validatePhone(number);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe(PHONE_ERROR_CODES.INVALID_INDIAN_MOBILE);
      });
    });
    
    test('should reject Indian mobile with incorrect length', () => {
      const invalidNumbers = ['98765432', '98765432101', '987654321'];
      
      invalidNumbers.forEach(number => {
        const result = validatePhone(number);
        expect(result.isValid).toBe(false);
      });
    });
    
    test('should handle Indian mobile numbers with formatting characters', () => {
      const formattedNumbers = [
        '987-654-3210',
        '987 654 3210', 
        '(987) 654-3210',
        '987.654.3210',
        '+91 987-654-3210'
      ];
      
      formattedNumbers.forEach(number => {
        const result = validatePhone(number);
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('indian_mobile');
      });
    });
  });
  
  // ─── International Phone Number Validation Tests ───────────────────────────────
  
  describe('validatePhone - International Numbers', () => {
    
    test('should validate US phone number', () => {
      const result = validatePhone('+12125551234');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('international');
      expect(result.countryCode).toBe(1);
      expect(result.country).toBe('US/Canada');
    });
    
    test('should validate UK phone number', () => {
      const result = validatePhone('+447911123456');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('international');
      expect(result.countryCode).toBe(44);
      expect(result.country).toBe('UK');
    });
    
    test('should validate German phone number', () => {
      const result = validatePhone('+4930123456789');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('international');
      expect(result.countryCode).toBe(49);
      expect(result.country).toBe('Germany');
    });

    test('should validate Japanese phone number', () => {
      const result = validatePhone('+819012345678');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('international');
      expect(result.countryCode).toBe(81);
      expect(result.country).toBe('Japan');
    });
    
    test('should reject international number without country code', () => {
      const result = validatePhone('2125551234', { allowInternational: true });
      expect(result.isValid).toBe(false);
    });
    
    test('should reject international number with invalid country code', () => {
      const result = validatePhone('+0123456789');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PHONE_ERROR_CODES.INVALID_COUNTRY_CODE);
    });
    
    test('should reject international number when not allowed', () => {
      const result = validatePhone('+12125551234', { allowInternational: false });
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PHONE_ERROR_CODES.INTERNATIONAL_NOT_ALLOWED);
    });
    
    test('should validate international number with correct length for country', () => {
      // UK number with correct length (10 digits after country code)
      const result = validatePhone('+447911123456');
      expect(result.isValid).toBe(true);
    });
    
    test('should reject international number with incorrect length for country', () => {
      // UK number with incorrect length (too short)
      const result = validatePhone('+44791112');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PHONE_ERROR_CODES.INVALID_LENGTH);
    });
  });
  
  // ─── Input Validation and Edge Cases ───────────────────────────────────────────
  
  describe('validatePhone - Input Validation', () => {
    
    test('should reject empty string', () => {
      const result = validatePhone('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PHONE_ERROR_CODES.EMPTY_PHONE);
    });
    
    test('should reject null input', () => {
      const result = validatePhone(null);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PHONE_ERROR_CODES.EMPTY_PHONE);
    });
    
    test('should reject undefined input', () => {
      const result = validatePhone(undefined);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PHONE_ERROR_CODES.EMPTY_PHONE);
    });
    
    test('should reject non-string input', () => {
      const result = validatePhone(123456789);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PHONE_ERROR_CODES.EMPTY_PHONE);
    });
    
    test('should reject phone with invalid characters', () => {
      const result = validatePhone('987-654-32ab');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PHONE_ERROR_CODES.INVALID_CHARACTERS);
    });
    
    test('should handle whitespace-only input', () => {
      const result = validatePhone('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PHONE_ERROR_CODES.EMPTY_PHONE);
    });
    
    test('should trim whitespace from input', () => {
      const result = validatePhone('  9876543210  ');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('indian_mobile');
    });
  });
  
  // ─── Phone Number Cleaning Tests ───────────────────────────────────────────────
  
  describe('cleanPhoneNumber', () => {
    
    test('should remove common formatting characters', () => {
      expect(cleanPhoneNumber('987-654-3210')).toBe('9876543210');
      expect(cleanPhoneNumber('987 654 3210')).toBe('9876543210');
      expect(cleanPhoneNumber('(987) 654-3210')).toBe('9876543210');
      expect(cleanPhoneNumber('987.654.3210')).toBe('9876543210');
    });
    
    test('should preserve + for international numbers', () => {
      expect(cleanPhoneNumber('+91 987-654-3210')).toBe('+919876543210');
      expect(cleanPhoneNumber('+1 212-555-1234')).toBe('+12125551234');
    });
    
    test('should handle special Indian prefixes', () => {
      expect(cleanPhoneNumber('0091 9876543210')).toBe('+919876543210');
      expect(cleanPhoneNumber('91 9876543210')).toBe('+919876543210');
    });
    
    test('should return empty string for non-string input', () => {
      expect(cleanPhoneNumber(null)).toBe('');
      expect(cleanPhoneNumber(undefined)).toBe('');
      expect(cleanPhoneNumber(123)).toBe('');
    });
  });
  
  // ─── Phone Number Formatting Tests ─────────────────────────────────────────────
  
  describe('formatPhone', () => {
    
    test('should format Indian mobile number for display', () => {
      const result = formatPhone('9876543210');
      expect(result.isValid).toBe(true);
      expect(result.formatted).toBe('+91 98765 43210');
    });
    
    test('should format international number for display', () => {
      const result = formatPhone('+12125551234');
      expect(result.isValid).toBe(true);
      expect(result.formatted).toContain('+1');
    });
    
    test('should return error for invalid phone number', () => {
      const result = formatPhone('invalid');
      expect(result.isValid).toBe(false);
    });
    
    test('should format in national format', () => {
      const result = formatPhone('9876543210', { format: 'national' });
      expect(result.isValid).toBe(true);
      expect(result.formatted).toBe('9876543210');
    });
    
    test('should format in international format', () => {
      const result = formatPhone('9876543210', { format: 'international' });
      expect(result.isValid).toBe(true);
      expect(result.formatted).toBe('+919876543210');
    });
  });
  
  // ─── Phone Number Normalization Tests ──────────────────────────────────────────
  
  describe('normalizePhone', () => {
    
    test('should normalize Indian mobile number', () => {
      const result = normalizePhone('987-654-3210');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+919876543210');
      expect(result.type).toBe('indian_mobile');
    });
    
    test('should normalize international number', () => {
      const result = normalizePhone('+1 212-555-1234');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+12125551234');
      expect(result.type).toBe('international');
    });
    
    test('should return error for invalid number', () => {
      const result = normalizePhone('invalid');
      expect(result.isValid).toBe(false);
    });
  });
  
  // ─── Utility Function Tests ────────────────────────────────────────────────────
  
  describe('isIndianMobile', () => {
    
    test('should return true for valid Indian mobile numbers', () => {
      expect(isIndianMobile('9876543210')).toBe(true);
      expect(isIndianMobile('+919876543210')).toBe(true);
      expect(isIndianMobile('919876543210')).toBe(true);
    });
    
    test('should return false for non-Indian numbers', () => {
      expect(isIndianMobile('+12125551234')).toBe(false);
      expect(isIndianMobile('invalid')).toBe(false);
      expect(isIndianMobile('1234567890')).toBe(false);
    });
  });
  
  describe('isInternationalPhone', () => {
    
    test('should return true for valid international numbers', () => {
      expect(isInternationalPhone('+12125551234')).toBe(true);
      expect(isInternationalPhone('+447911123456')).toBe(true);
    });
    
    test('should return false for non-international numbers', () => {
      expect(isInternationalPhone('9876543210')).toBe(false);
      expect(isInternationalPhone('invalid')).toBe(false);
    });
  });
  
  describe('getCountryInfo', () => {
    
    test('should return country info for valid international number', () => {
      const result = getCountryInfo('+12125551234');
      expect(result).not.toBeNull();
      expect(result.countryCode).toBe(1);
      expect(result.country).toBe('US/Canada');
    });
    
    test('should return country info for Indian number', () => {
      const result = getCountryInfo('9876543210');
      expect(result).not.toBeNull();
      expect(result.countryCode).toBe(91);
      expect(result.country).toBe('India');
    });
    
    test('should return null for invalid number', () => {
      const result = getCountryInfo('invalid');
      expect(result).toBeNull();
    });
  });
  
  // ─── Batch Validation Tests ────────────────────────────────────────────────────
  
  describe('validatePhonesBatch', () => {
    
    test('should validate multiple phone numbers', () => {
      const phones = ['9876543210', '+12125551234', 'invalid', '+919876543210'];
      const results = validatePhonesBatch(phones);
      
      expect(results).toHaveLength(4);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
      expect(results[3].isValid).toBe(true);
    });
    
    test('should throw error for non-array input', () => {
      expect(() => validatePhonesBatch('not-array')).toThrow('Input must be an array');
    });
    
    test('should handle empty array', () => {
      const results = validatePhonesBatch([]);
      expect(results).toHaveLength(0);
    });
  });
  
  // ─── Specific Formatting Function Tests ────────────────────────────────────────
  
  describe('formatIndianMobile', () => {
    
    test('should format 10-digit number with country code', () => {
      const result = formatIndianMobile('9876543210');
      expect(result).toBe('+91 98765 43210');
    });
    
    test('should format 10-digit number without country code', () => {
      const result = formatIndianMobile('9876543210', { includeCountryCode: false });
      expect(result).toBe('98765 43210');
    });
    
    test('should use custom separator', () => {
      const result = formatIndianMobile('9876543210', { separator: '-' });
      expect(result).toBe('+91-98765-43210');
    });
    
    test('should return original for invalid length', () => {
      const result = formatIndianMobile('98765432');
      expect(result).toBe('98765432');
    });
  });
  
  describe('formatInternationalPhone', () => {
    
    test('should format international number with default separator', () => {
      const result = formatInternationalPhone(1, '2125551234');
      expect(result).toBe('+1 21255 51234');
    });
    
    test('should format short international number', () => {
      const result = formatInternationalPhone(44, '12345');
      expect(result).toBe('+44 12345');
    });
    
    test('should use custom separator', () => {
      const result = formatInternationalPhone(1, '2125551234', { separator: '-' });
      expect(result).toBe('+1-21255-51234');
    });
  });
  
  // ─── Options and Configuration Tests ───────────────────────────────────────────
  
  describe('validatePhone - Options', () => {
    
    test('should require Indian numbers only when requireIndian is true', () => {
      const result = validatePhone('+12125551234', { requireIndian: true });
      expect(result.isValid).toBe(false);
    });
    
    test('should allow Indian numbers when requireIndian is true', () => {
      const result = validatePhone('9876543210', { requireIndian: true });
      expect(result.isValid).toBe(true);
    });
    
    test('should reject international when allowInternational is false', () => {
      const result = validatePhone('+12125551234', { allowInternational: false });
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(PHONE_ERROR_CODES.INTERNATIONAL_NOT_ALLOWED);
    });
  });
  
  // ─── Zod Integration Tests ─────────────────────────────────────────────────────
  
  describe('createPhoneSchema', () => {
    
    test('should create Zod schema that validates Indian mobile', () => {
      const schema = createPhoneSchema();
      const result = schema.safeParse('9876543210');
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('+919876543210');
    });
    
    test('should create Zod schema that validates international number', () => {
      const schema = createPhoneSchema();
      const result = schema.safeParse('+12125551234');
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('+12125551234');
    });
    
    test('should create Zod schema that rejects invalid number', () => {
      const schema = createPhoneSchema();
      const result = schema.safeParse('invalid');
      
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Invalid phone number');
    });
    
    test('should create Zod schema with custom options', () => {
      const schema = createPhoneSchema({ requireIndian: true });
      
      const indianResult = schema.safeParse('9876543210');
      expect(indianResult.success).toBe(true);
      
      const intlResult = schema.safeParse('+12125551234');
      expect(intlResult.success).toBe(false);
    });
    
    test('should create Zod schema that trims whitespace', () => {
      const schema = createPhoneSchema();
      const result = schema.safeParse('  9876543210  ');
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('+919876543210');
    });
    
    test('should create Zod schema that rejects empty string', () => {
      const schema = createPhoneSchema();
      const result = schema.safeParse('');
      
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Phone number is required');
    });
  });
  
  // ─── Error Code and Message Tests ──────────────────────────────────────────────
  
  describe('Error Handling', () => {
    
    test('should return correct error codes for different validation failures', () => {
      // Empty phone
      expect(validatePhone('').error).toBe(PHONE_ERROR_CODES.EMPTY_PHONE);
      
      // Invalid characters
      expect(validatePhone('987abc3210').error).toBe(PHONE_ERROR_CODES.INVALID_CHARACTERS);
      
      // Invalid Indian mobile
      expect(validatePhone('1234567890').error).toBe(PHONE_ERROR_CODES.INVALID_INDIAN_MOBILE);
      
      // International not allowed
      expect(validatePhone('+12125551234', { allowInternational: false }).error)
        .toBe(PHONE_ERROR_CODES.INTERNATIONAL_NOT_ALLOWED);
    });
    
    test('should include original input in error response', () => {
      const result = validatePhone('invalid-phone');
      expect(result.input).toBe('invalid-phone');
    });
    
    test('should include cleaned input in response', () => {
      const result = validatePhone('987-654-3210');
      expect(result.cleaned).toBe('9876543210');
    });
  });
  
  // ─── Integration and Real-World Usage Tests ────────────────────────────────────
  
  describe('Real-World Usage Scenarios', () => {
    
    test('should handle common Indian mobile formats from user input', () => {
      const commonFormats = [
        '9876543210',
        '098 765 432 10',
        '+91 98765 43210',
        '91-9876543210',
        '(+91) 9876543210',
        '+91-9876-543-210'
      ];
      
      commonFormats.forEach(format => {
        const result = validatePhone(format);
        expect(result.isValid).toBe(true);
        expect(result.normalized).toBe('+919876543210');
      });
    });
    
    test('should handle common international formats', () => {
      const intlFormats = [
        '+1 212-555-1234',
        '+44 79 1112 3456',
        '+49 30 123456789'
      ];
      
      intlFormats.forEach(format => {
        const result = validatePhone(format);
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('international');
      });
    });
    
    test('should provide consistent normalized format for database storage', () => {
      const variations = ['9876543210', '+91 9876543210', '091-9876543210'];
      const normalized = '+919876543210';
      
      variations.forEach(variation => {
        const result = validatePhone(variation);
        expect(result.isValid).toBe(true);
        expect(result.normalized).toBe(normalized);
      });
    });
    
    test('should provide user-friendly formatted display', () => {
      const result = validatePhone('9876543210');
      expect(result.isValid).toBe(true);
      expect(result.formatted).toBe('+91 98765 43210');
    });
  });
});
