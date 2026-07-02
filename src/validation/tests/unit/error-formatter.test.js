'use strict';

/**
 * Unit Tests for Error Formatter Helper
 * 
 * Tests consistent error response formatting, security-aware disclosure,
 * and localization support as required by R7.1, R7.3, and R7.4.
 */

const { z } = require('zod');
const {
  formatValidationError,
  formatFileUploadError,
  formatRateLimitError,
  formatAuthorizationError,
  createErrorFormatter,
  getAvailableLocales,
  addLocaleMessages,
  isSensitiveField,
  sanitizeValue,
  ERROR_SEVERITY,
  ERROR_CATEGORIES,
} = require('../../helpers/error-formatter');

describe('Error Formatter Helper', () => {
  describe('formatValidationError', () => {
    test('should format Zod validation errors correctly', () => {
      const schema = z.object({
        name: z.string().min(2),
        email: z.string().email(),
        age: z.number().min(0),
      });
      
      const result = schema.safeParse({
        name: 'A',
        email: 'invalid-email',
        age: -5,
      });
      
      const formattedError = formatValidationError(result.error);
      
      expect(formattedError).toMatchObject({
        success: false,
        error: 'ValidationError',
        category: ERROR_CATEGORIES.VALIDATION,
        severity: ERROR_SEVERITY.MEDIUM,
        errors: expect.arrayContaining([
          expect.objectContaining({
            field: 'name',
            code: 'LENGTH_INSUFFICIENT',
          }),
          expect.objectContaining({
            field: 'email', 
            code: 'STRING_INVALID',
          }),
          expect.objectContaining({
            field: 'age',
            code: 'LENGTH_INSUFFICIENT',
          }),
        ]),
      });
      
      expect(formattedError.requestId).toBeDefined();
      expect(formattedError.timestamp).toBeDefined();
    });
    
    test('should handle custom validation errors', () => {
      const customError = {
        name: 'ValidationError',
        message: 'Custom validation failed',
        errors: [{
          field: 'customField',
          code: 'CUSTOM_ERROR',
          message: 'Custom error message',
        }],
      };
      
      const formattedError = formatValidationError(customError);
      
      expect(formattedError).toMatchObject({
        success: false,
        error: 'ValidationError',
        message: 'Custom validation failed',
        errors: [{
          field: 'customField',
          code: 'CUSTOM_ERROR',
          message: 'Custom error message',
        }],
      });
    });
    
    test('should handle business rule errors', () => {
      const businessError = {
        type: 'BusinessRuleError',
        message: 'COD amount exceeds limit',
        rule: 'COD_AMOUNT_LIMIT',
        field: 'codAmount',
        code: 'BUSINESS_RULE_VIOLATION',
        context: { maxAmount: 50000 },
      };
      
      const formattedError = formatValidationError(businessError);
      
      expect(formattedError).toMatchObject({
        category: ERROR_CATEGORIES.BUSINESS_RULE,
        severity: ERROR_SEVERITY.HIGH,
        rule: 'COD_AMOUNT_LIMIT',
        context: { maxAmount: 50000 },
      });
    });
    
    test('should handle security errors with minimal disclosure', () => {
      const securityError = {
        type: 'SecurityError',
        message: 'Potential injection detected',
        field: 'maliciousInput',
      };
      
      const formattedError = formatValidationError(securityError);
      
      expect(formattedError).toMatchObject({
        category: ERROR_CATEGORIES.SECURITY,
        severity: ERROR_SEVERITY.CRITICAL,
        errors: [{
          field: 'security',
          code: 'SECURITY_VIOLATION',
        }],
      });
      
      // Should not expose detailed security information
      expect(formattedError.message).not.toContain('injection');
    });
    
    test('should support localization', () => {
      const zodError = z.string().min(5).safeParse('abc').error;
      
      // Test English (default)
      const englishError = formatValidationError(zodError, { locale: 'en' });
      expect(englishError.locale).toBe('en');
      
      // Test Spanish
      const spanishError = formatValidationError(zodError, { locale: 'es' });
      expect(spanishError.locale).toBe('es');
      
      // Test Hindi
      const hindiError = formatValidationError(zodError, { locale: 'hi' });
      expect(hindiError.locale).toBe('hi');
    });
    
    test('should redact sensitive fields', () => {
      const schema = z.object({
        username: z.string(),
        password: z.string().min(8),
        email: z.string().email(),
      });
      
      const result = schema.safeParse({
        username: 'user123',
        password: 'weak',
        email: 'invalid',
      });
      
      const formattedError = formatValidationError(result.error);
      
      const passwordError = formattedError.errors.find(e => e.field === 'password');
      expect(passwordError).toBeDefined();
      expect(passwordError.received).toBeUndefined(); // Should be redacted
      
      const emailError = formattedError.errors.find(e => e.field === 'email');
      expect(emailError).toBeDefined();
      expect(emailError.received).toBeDefined(); // Email is not sensitive by default
    });
    
    test('should truncate long error lists', () => {
      const schema = z.object({
        items: z.array(z.string().min(10)).max(5),
      });
      
      // Create data that will generate many errors
      const invalidData = {
        items: Array(25).fill('a'), // 25 items with single character (multiple errors)
      };
      
      const result = schema.safeParse(invalidData);
      const formattedError = formatValidationError(result.error, { maxErrorsShown: 10 });
      
      expect(formattedError.errors.length).toBeLessThanOrEqual(10);
      expect(formattedError.truncated).toBe(true);
      expect(formattedError.totalErrors).toBeGreaterThan(10);
    });
  });
  
  describe('Specialized Error Formatters', () => {
    test('should format file upload errors', () => {
      const fileError = {
        message: 'File too large',
        code: 'FILE_SIZE_EXCEEDED',
        maxSize: 5242880, // 5MB
        actualSize: 10485760, // 10MB
      };
      
      const formattedError = formatFileUploadError(fileError);
      
      expect(formattedError).toMatchObject({
        category: ERROR_CATEGORIES.FILE_UPLOAD,
        severity: ERROR_SEVERITY.MEDIUM,
      });
    });
    
    test('should format rate limit errors', () => {
      const rateLimitError = {
        message: 'Too many requests',
        retryAfter: 60,
        limit: 100,
        window: 3600,
      };
      
      const formattedError = formatRateLimitError(rateLimitError);
      
      expect(formattedError).toMatchObject({
        category: ERROR_CATEGORIES.RATE_LIMIT,
        severity: ERROR_SEVERITY.HIGH,
      });
    });
    
    test('should format authorization errors', () => {
      const authError = {
        message: 'Insufficient permissions',
        requiredRole: 'admin',
        userRole: 'user',
      };
      
      const formattedError = formatAuthorizationError(authError);
      
      expect(formattedError).toMatchObject({
        category: ERROR_CATEGORIES.AUTHORIZATION,
        severity: ERROR_SEVERITY.HIGH,
      });
    });
  });
  
  describe('Custom Error Formatter', () => {
    test('should create custom formatter with configuration', () => {
      const customFormatter = createErrorFormatter({
        includeStackTrace: true,
        maxErrorsShown: 5,
        defaultLocale: 'es',
      });
      
      const zodError = z.string().min(5).safeParse('abc').error;
      const formattedError = customFormatter(zodError);
      
      expect(formattedError.locale).toBe('es');
      expect(formattedError.stack).toBeDefined();
    });
  });
  
  describe('Localization Functions', () => {
    test('should get available locales', () => {
      const locales = getAvailableLocales();
      
      expect(locales).toContain('en');
      expect(locales).toContain('es');
      expect(locales).toContain('hi');
      expect(Array.isArray(locales)).toBe(true);
    });
    
    test('should add custom locale messages', () => {
      addLocaleMessages('fr', {
        VALIDATION_FAILED: 'Validation échouée',
        FIELD_REQUIRED: 'Ce champ est requis',
      });
      
      const locales = getAvailableLocales();
      expect(locales).toContain('fr');
    });
  });
  
  describe('Utility Functions', () => {
    describe('isSensitiveField', () => {
      test('should identify sensitive field names', () => {
        expect(isSensitiveField('password', 'secret123')).toBe(true);
        expect(isSensitiveField('authToken', 'token123')).toBe(true);
        expect(isSensitiveField('apiKey', 'key123')).toBe(true);
        expect(isSensitiveField('userSecret', 'secret')).toBe(true);
        
        expect(isSensitiveField('username', 'user123')).toBe(false);
        expect(isSensitiveField('email', 'user@example.com')).toBe(false);
        expect(isSensitiveField('name', 'John Doe')).toBe(false);
      });
      
      test('should identify sensitive values', () => {
        // Credit card pattern
        expect(isSensitiveField('cardNumber', '4111 1111 1111 1111')).toBe(true);
        
        // Base64 encoded (potential token)
        expect(isSensitiveField('data', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe(true);
        
        // Hex encoded (potential hash/key)
        expect(isSensitiveField('hash', 'a1b2c3d4e5f6789012345678901234567890abcd')).toBe(true);
        
        expect(isSensitiveField('description', 'Simple text description')).toBe(false);
      });
    });
    
    describe('sanitizeValue', () => {
      test('should truncate long strings', () => {
        const longString = 'a'.repeat(200);
        const sanitized = sanitizeValue(longString, 100);
        
        expect(sanitized).toHaveLength(103); // 100 + '...'
        expect(sanitized.endsWith('...')).toBe(true);
      });
      
      test('should handle different value types', () => {
        expect(sanitizeValue(['a', 'b', 'c'], 100)).toBe('Array(3)');
        expect(sanitizeValue({ a: 1, b: 2 }, 100)).toBe('Object(2 properties)');
        expect(sanitizeValue(123, 100)).toBe('123');
        expect(sanitizeValue(null, 100)).toBe(null);
        expect(sanitizeValue(undefined, 100)).toBe(undefined);
      });
    });
  });
  
  describe('Error Response Structure', () => {
    test('should have consistent response structure', () => {
      const zodError = z.string().email().safeParse('invalid').error;
      const formattedError = formatValidationError(zodError);
      
      // Required fields
      expect(formattedError.success).toBe(false);
      expect(formattedError.error).toBe('ValidationError');
      expect(formattedError.requestId).toBeDefined();
      expect(formattedError.timestamp).toBeDefined();
      expect(formattedError.locale).toBeDefined();
      expect(formattedError.message).toBeDefined();
      expect(formattedError.category).toBeDefined();
      expect(formattedError.severity).toBeDefined();
      expect(Array.isArray(formattedError.errors)).toBe(true);
      expect(typeof formattedError.errorCount).toBe('number');
      
      // Error entry structure
      const error = formattedError.errors[0];
      expect(error.field).toBeDefined();
      expect(error.code).toBeDefined();
      expect(error.message).toBeDefined();
    });
    
    test('should include request ID when provided', () => {
      const zodError = z.string().min(5).safeParse('abc').error;
      const requestId = 'test-request-123';
      
      const formattedError = formatValidationError(zodError, { requestId });
      
      expect(formattedError.requestId).toBe(requestId);
    });
    
    test('should generate request ID when not provided', () => {
      const zodError = z.string().min(5).safeParse('abc').error;
      const formattedError = formatValidationError(zodError);
      
      expect(formattedError.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });
});