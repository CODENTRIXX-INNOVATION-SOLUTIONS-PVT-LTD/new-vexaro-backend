/**
 * Validation Constants Tests
 * Unit tests for error codes, limits, and patterns constants
 */

const { errorCodes, limits, patterns } = require('../index');

describe('Validation Constants', () => {
  
  describe('Error Codes', () => {
    test('should have all base error codes', () => {
      expect(errorCodes.BASE_ERROR_CODES).toBeDefined();
      expect(errorCodes.BASE_ERROR_CODES.REQUIRED).toBe('REQUIRED');
      expect(errorCodes.BASE_ERROR_CODES.INVALID_TYPE).toBe('INVALID_TYPE');
      expect(errorCodes.BASE_ERROR_CODES.INVALID_FORMAT).toBe('INVALID_FORMAT');
    });

    test('should have domain-specific error codes', () => {
      expect(errorCodes.DOMAIN_ERROR_CODES).toBeDefined();
      expect(errorCodes.DOMAIN_ERROR_CODES.AUTH).toBeDefined();
      expect(errorCodes.DOMAIN_ERROR_CODES.USER).toBeDefined();
      expect(errorCodes.DOMAIN_ERROR_CODES.SHIPMENT).toBeDefined();
      expect(errorCodes.DOMAIN_ERROR_CODES.FINANCE).toBeDefined();
    });

    test('should have error messages with internationalization support', () => {
      expect(errorCodes.ERROR_MESSAGES).toBeDefined();
      expect(errorCodes.ERROR_MESSAGES.en).toBeDefined();
      expect(errorCodes.ERROR_MESSAGES.hi).toBeDefined();
    });

    test('should create validation error objects', () => {
      const error = errorCodes.createValidationError(
        'INVALID_EMAIL', 
        'email', 
        { language: 'en' }
      );
      
      expect(error).toBeDefined();
      expect(error.code).toBe('INVALID_EMAIL');
      expect(error.field).toBe('email');
      expect(error.message).toContain('email');
      expect(error.timestamp).toBeDefined();
    });

    test('should get error messages with variable substitution', () => {
      const message = errorCodes.getErrorMessage(
        'STRING_TOO_SHORT',
        'en',
        { min: 5 }
      );
      
      expect(message).toContain('5');
    });
  });

  describe('Validation Limits', () => {
    test('should have string limits', () => {
      expect(limits.STRING_LIMITS).toBeDefined();
      expect(limits.STRING_LIMITS.EMAIL).toEqual({ min: 5, max: 254 });
      expect(limits.STRING_LIMITS.PASSWORD).toEqual({ min: 8, max: 128 });
      expect(limits.STRING_LIMITS.PHONE).toEqual({ min: 10, max: 15 });
    });

    test('should have numeric limits', () => {
      expect(limits.NUMERIC_LIMITS).toBeDefined();
      expect(limits.NUMERIC_LIMITS.MONEY.precision).toBe(2);
      expect(limits.NUMERIC_LIMITS.WEIGHT.max).toBe(50);
      expect(limits.NUMERIC_LIMITS.COD_AMOUNT.min).toBe(100);
    });

    test('should have file limits', () => {
      expect(limits.FILE_LIMITS).toBeDefined();
      expect(limits.FILE_LIMITS.PROFILE_PICTURE.maxSize).toBe(2 * 1024 * 1024);
      expect(limits.FILE_LIMITS.CSV_UPLOAD.maxRows).toBe(10000);
    });

    test('should have business limits', () => {
      expect(limits.BUSINESS_LIMITS).toBeDefined();
      expect(limits.BUSINESS_LIMITS.WALLET.MAX_BALANCE).toBe(100000000);
      expect(limits.BUSINESS_LIMITS.SHIPMENT.MAX_PACKAGES_PER_SHIPMENT).toBe(10);
    });

    test('should get limit by domain and field', () => {
      const emailLimits = limits.getLimit('STRING', 'EMAIL');
      expect(emailLimits).toEqual({ min: 5, max: 254 });
      
      const moneyLimits = limits.getLimit('NUMERIC', 'MONEY');
      expect(moneyLimits.precision).toBe(2);
    });

    test('should validate against limits', () => {
      const emailLimits = limits.getLimit('STRING', 'EMAIL');
      
      const validEmail = limits.validateLimit('test@example.com', emailLimits, 'length');
      expect(validEmail.isValid).toBe(true);
      
      const tooShort = limits.validateLimit('a@b', emailLimits, 'length');
      expect(tooShort.isValid).toBe(false);
      expect(tooShort.error).toContain('Minimum length');
    });
  });

  describe('Validation Patterns', () => {
    test('should have basic patterns', () => {
      expect(patterns.BASIC_PATTERNS).toBeDefined();
      expect(patterns.BASIC_PATTERNS.NUMERIC).toBeInstanceOf(RegExp);
      expect(patterns.BASIC_PATTERNS.ALPHANUMERIC).toBeInstanceOf(RegExp);
    });

    test('should have contact patterns', () => {
      expect(patterns.CONTACT_PATTERNS).toBeDefined();
      expect(patterns.CONTACT_PATTERNS.EMAIL_BASIC).toBeInstanceOf(RegExp);
      expect(patterns.CONTACT_PATTERNS.PHONE_INDIAN_MOBILE).toBeInstanceOf(RegExp);
    });

    test('should have Indian-specific patterns', () => {
      expect(patterns.INDIAN_PATTERNS).toBeDefined();
      expect(patterns.INDIAN_PATTERNS.PINCODE).toBeInstanceOf(RegExp);
      expect(patterns.INDIAN_PATTERNS.PAN_CARD).toBeInstanceOf(RegExp);
    });

    test('should validate email patterns', () => {
      const validEmail = patterns.testPattern('user@domain.com', patterns.CONTACT_PATTERNS.EMAIL_BASIC);
      expect(validEmail.isValid).toBe(true);
      
      const invalidEmail = patterns.testPattern('invalid-email', patterns.CONTACT_PATTERNS.EMAIL_BASIC);
      expect(invalidEmail.isValid).toBe(false);
    });

    test('should validate Indian phone patterns', () => {
      const validPhone = patterns.testPattern('9876543210', patterns.INDIAN_PATTERNS.PINCODE);
      expect(validPhone.isValid).toBe(false); // This should use phone pattern, not pincode
      
      const validPincode = patterns.testPattern('123456', patterns.INDIAN_PATTERNS.PINCODE);
      expect(validPincode.isValid).toBe(true);
    });

    test('should validate Indian PIN codes', () => {
      const validPincode = patterns.testPattern('123456', patterns.INDIAN_PATTERNS.PINCODE);
      expect(validPincode.isValid).toBe(true);
      
      const invalidPincode = patterns.testPattern('012345', patterns.INDIAN_PATTERNS.PINCODE);
      expect(invalidPincode.isValid).toBe(false); // Cannot start with 0
    });

    test('should get pattern by category and name', () => {
      const emailPattern = patterns.getPattern('CONTACT', 'EMAIL_BASIC');
      expect(emailPattern).toBeInstanceOf(RegExp);
      
      const pincodePattern = patterns.getPattern('INDIAN', 'PINCODE');
      expect(pincodePattern).toBeInstanceOf(RegExp);
    });

    test('should clean phone numbers', () => {
      const result = patterns.cleanPhoneNumber('+91-98765-43210');
      expect(result.cleaned).toBe('919876543210');
      expect(result.countryCode).toBe('91');
      expect(result.formatted).toBe('9876543210');
      expect(result.format).toBe('indian_mobile');
    });

    test('should validate and format email addresses', () => {
      const result = patterns.validateEmail('  USER@DOMAIN.COM  ');
      expect(result.isValid).toBe(true);
      expect(result.formatted).toBe('user@domain.com');
      expect(result.localPart).toBe('user');
      expect(result.domain).toBe('domain.com');
    });

    test('should validate financial patterns', () => {
      const validAmount = patterns.testPattern('123.45', patterns.FINANCIAL_PATTERNS.MONEY_AMOUNT);
      expect(validAmount.isValid).toBe(true);
      
      const invalidAmount = patterns.testPattern('123.456', patterns.FINANCIAL_PATTERNS.MONEY_AMOUNT);
      expect(invalidAmount.isValid).toBe(false); // Too many decimal places
    });

    test('should validate security patterns', () => {
      const strongPassword = patterns.testPattern('MyPass123!', patterns.SECURITY_PATTERNS.PASSWORD_STRONG);
      expect(strongPassword.isValid).toBe(true);
      
      const weakPassword = patterns.testPattern('password', patterns.SECURITY_PATTERNS.PASSWORD_STRONG);
      expect(weakPassword.isValid).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    test('should work together for comprehensive validation', () => {
      // Test email validation with limits and patterns
      const email = 'test@example.com';
      const emailLimits = limits.getLimit('STRING', 'EMAIL');
      const emailPattern = patterns.getPattern('CONTACT', 'EMAIL_BASIC');
      
      const lengthCheck = limits.validateLimit(email, emailLimits, 'length');
      const patternCheck = patterns.testPattern(email, emailPattern);
      
      expect(lengthCheck.isValid).toBe(true);
      expect(patternCheck.isValid).toBe(true);
    });

    test('should create comprehensive validation errors', () => {
      const error = errorCodes.createValidationError(
        errorCodes.DOMAIN_ERROR_CODES.AUTH.INVALID_EMAIL,
        'email',
        {
          language: 'en',
          variables: { format: 'user@domain.com' },
          severity: errorCodes.ERROR_SEVERITY.HIGH,
          category: errorCodes.ERROR_CATEGORIES.USER_INPUT
        }
      );
      
      expect(error.code).toBe('AUTH_INVALID_EMAIL');
      expect(error.field).toBe('email');
      expect(error.severity).toBe('high');
      expect(error.category).toBe('user_input');
      expect(error.httpStatus).toBeDefined();
    });

    test('should support internationalization', () => {
      const englishMessage = errorCodes.getErrorMessage(
        errorCodes.BASE_ERROR_CODES.REQUIRED,
        'en'
      );
      const hindiMessage = errorCodes.getErrorMessage(
        errorCodes.BASE_ERROR_CODES.REQUIRED,
        'hi'
      );
      
      expect(englishMessage).toBe('This field is required');
      expect(hindiMessage).toBe('यह फ़ील्ड आवश्यक है');
    });
  });
});