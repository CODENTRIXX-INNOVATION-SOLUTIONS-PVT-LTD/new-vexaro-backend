'use strict';

/**
 * Test suite for validation framework main exports
 */

const validationFramework = require('../index');

describe('Validation Framework - Main Exports', () => {
  describe('Framework Structure', () => {
    test('should export main framework components', () => {
      expect(validationFramework).toHaveProperty('schemas');
      expect(validationFramework).toHaveProperty('middleware');
      expect(validationFramework).toHaveProperty('utils');
      expect(validationFramework).toHaveProperty('constants');
    });

    test('should export convenience functions', () => {
      expect(validationFramework).toHaveProperty('validate');
      expect(validationFramework).toHaveProperty('createValidator');
      expect(validationFramework).toHaveProperty('createMultiValidator');
      expect(validationFramework).toHaveProperty('initializeFramework');
      expect(validationFramework).toHaveProperty('getFrameworkConfig');
      expect(validationFramework).toHaveProperty('resetFrameworkConfig');
    });

    test('should export common schemas', () => {
      expect(validationFramework).toHaveProperty('mongoIdSchema');
    });

    test('should export domain-specific schemas', () => {
      expect(validationFramework).toHaveProperty('authSchemas');
      expect(validationFramework).toHaveProperty('shipmentSchemas');
      expect(validationFramework).toHaveProperty('userSchemas');
      expect(validationFramework).toHaveProperty('financeSchemas');
    });
  });

  describe('Schema Collections', () => {
    test('should have organized schema collections', () => {
      const { schemas } = validationFramework;
      
      expect(schemas).toHaveProperty('auth');
      expect(schemas).toHaveProperty('shipments');
      expect(schemas).toHaveProperty('users');
      expect(schemas).toHaveProperty('finance');
      expect(schemas).toHaveProperty('disputes');
      expect(schemas).toHaveProperty('support');
      expect(schemas).toHaveProperty('reports');
      expect(schemas).toHaveProperty('notifications');
      expect(schemas).toHaveProperty('rates');
      expect(schemas).toHaveProperty('settings');
      expect(schemas).toHaveProperty('common');
    });

    test('should have common utility schemas', () => {
      const { schemas } = validationFramework;
      expect(schemas.common).toHaveProperty('mongoIdSchema');
    });

    test('should have auth schemas', () => {
      const { schemas } = validationFramework;
      expect(schemas.auth).toHaveProperty('loginSchema');
      expect(schemas.auth).toHaveProperty('forgotPasswordSchema');
      expect(schemas.auth).toHaveProperty('resetPasswordSchema');
    });

    test('should have shipment schemas', () => {
      const { schemas } = validationFramework;
      expect(schemas.shipments).toHaveProperty('createShipmentSchema');
      expect(schemas.shipments).toHaveProperty('updateShipmentSchema');
      expect(schemas.shipments).toHaveProperty('listShipmentsQuerySchema');
    });
  });

  describe('Middleware Functions', () => {
    test('should have core middleware functions', () => {
      const { middleware } = validationFramework;
      
      expect(middleware).toHaveProperty('validate');
      expect(middleware).toHaveProperty('createValidator');
      expect(middleware).toHaveProperty('createMultiValidator');
      
      expect(typeof middleware.validate).toBe('function');
      expect(typeof middleware.createValidator).toBe('function');
      expect(typeof middleware.createMultiValidator).toBe('function');
    });
  });

  describe('Framework Configuration', () => {
    beforeEach(() => {
      // Reset configuration before each test
      validationFramework.resetFrameworkConfig();
    });

    test('should initialize with default configuration', () => {
      const config = validationFramework.getFrameworkConfig();
      
      expect(config).toHaveProperty('errorFormat', 'detailed');
      expect(config).toHaveProperty('includeStackTrace', false);
      expect(config).toHaveProperty('enableCaching', false);
      expect(config).toHaveProperty('sanitizeInput', true);
      expect(config).toHaveProperty('abortEarly', false);
      expect(config).toHaveProperty('stripUnknown', false);
    });

    test('should allow custom configuration', () => {
      const customConfig = {
        errorFormat: 'simple',
        enableCaching: true,
        cacheTimeout: 600,
      };
      
      const result = validationFramework.initializeFramework(customConfig);
      
      expect(result.errorFormat).toBe('simple');
      expect(result.enableCaching).toBe(true);
      expect(result.cacheTimeout).toBe(600);
      expect(result.sanitizeInput).toBe(true); // Should keep defaults for non-specified values
    });

    test('should reset to default configuration', () => {
      // Set custom config
      validationFramework.initializeFramework({ errorFormat: 'simple', enableCaching: true });
      
      // Reset to defaults
      const resetConfig = validationFramework.resetFrameworkConfig();
      
      expect(resetConfig.errorFormat).toBe('detailed');
      expect(resetConfig.enableCaching).toBe(false);
    });

    test('should get current framework configuration', () => {
      const customConfig = { errorFormat: 'simple' };
      validationFramework.initializeFramework(customConfig);
      
      const currentConfig = validationFramework.getFrameworkConfig();
      expect(currentConfig.errorFormat).toBe('simple');
    });
  });

  describe('Constants', () => {
    test('should export validation constants', () => {
      const { constants } = validationFramework;
      
      expect(constants).toHaveProperty('DEFAULT_CONFIG');
      expect(constants).toHaveProperty('ERROR_CODES');
      expect(constants).toHaveProperty('LIMITS');
    });

    test('should have error codes', () => {
      const { constants } = validationFramework;
      
      expect(constants.ERROR_CODES).toHaveProperty('VALIDATION_FAILED');
      expect(constants.ERROR_CODES).toHaveProperty('INVALID_SCHEMA');
      expect(constants.ERROR_CODES).toHaveProperty('MISSING_FIELD');
      expect(constants.ERROR_CODES).toHaveProperty('INVALID_FORMAT');
    });

    test('should have validation limits', () => {
      const { constants } = validationFramework;
      
      expect(constants.LIMITS).toHaveProperty('MAX_STRING_LENGTH');
      expect(constants.LIMITS).toHaveProperty('MAX_NUMBER_VALUE');
      expect(constants.LIMITS).toHaveProperty('MAX_ARRAY_LENGTH');
      expect(constants.LIMITS).toHaveProperty('MAX_OBJECT_DEPTH');
    });
  });

  describe('Utility Functions', () => {
    test('should have configuration utilities', () => {
      const { utils } = validationFramework;
      
      expect(utils).toHaveProperty('initializeFramework');
      expect(utils).toHaveProperty('getFrameworkConfig');
      expect(utils).toHaveProperty('resetFrameworkConfig');
      expect(utils).toHaveProperty('formatValidationError');
    });

    test('should format validation errors', () => {
      // Ensure we're in detailed mode
      validationFramework.initializeFramework({ errorFormat: 'detailed' });
      
      const { utils } = validationFramework;
      
      const error = {
        message: 'Test validation error',
        errors: [{ field: 'email', message: 'Invalid email' }],
      };
      
      const formattedError = utils.formatValidationError(error, 'test-req-123');
      
      expect(formattedError).toHaveProperty('success', false);
      expect(formattedError).toHaveProperty('requestId', 'test-req-123');
      expect(formattedError).toHaveProperty('timestamp');
      expect(formattedError).toHaveProperty('message', 'Test validation error');
      expect(formattedError).toHaveProperty('error', 'ValidationError');
      expect(formattedError).toHaveProperty('errors');
      expect(Array.isArray(formattedError.errors)).toBe(true);
    });

    test('should format simple validation errors', () => {
      // Set simple error format
      validationFramework.initializeFramework({ errorFormat: 'simple' });
      
      const { utils } = validationFramework;
      const error = { message: 'Test validation error' };
      const formattedError = utils.formatValidationError(error);
      
      expect(formattedError).toHaveProperty('success', false);
      expect(formattedError).toHaveProperty('message', 'Test validation error');
      expect(formattedError).toHaveProperty('error', 'ValidationError');
      expect(formattedError).not.toHaveProperty('errors');
    });
  });

  describe('Validator Creation', () => {
    test('should create single validator middleware', () => {
      const { z } = require('zod/v4');
      const testSchema = z.object({ name: z.string() });
      
      const validator = validationFramework.createValidator(testSchema, 'body');
      
      expect(typeof validator).toBe('function');
      expect(validator.length).toBe(3); // Express middleware signature (req, res, next)
    });

    test('should create multi-target validator middleware', () => {
      const { z } = require('zod/v4');
      const schemas = {
        body: z.object({ name: z.string() }),
        query: z.object({ page: z.string().optional() }),
      };
      
      const validators = validationFramework.createMultiValidator(schemas);
      
      expect(Array.isArray(validators)).toBe(true);
      expect(validators.length).toBe(2);
      validators.forEach(validator => {
        expect(typeof validator).toBe('function');
        expect(validator.length).toBe(3);
      });
    });
  });
});