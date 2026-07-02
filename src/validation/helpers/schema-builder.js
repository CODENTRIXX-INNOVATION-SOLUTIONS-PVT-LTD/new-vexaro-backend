'use strict';

/**
 * Enterprise Validation Framework - Dynamic Schema Builder
 * 
 * Provides utilities for dynamic schema construction and composition. Enables
 * runtime schema building, conditional validation, and schema transformations
 * for complex business rules and flexible API validation requirements.
 * 
 * @module SchemaBuilder
 */

const { z } = require('zod');

// ─── Schema Building Configuration ──────────────────────────────────────────────

/**
 * Default schema builder configuration
 */
const DEFAULT_BUILDER_CONFIG = {
  enableOptionalChaining: true,
  enableTransformations: true,
  enableCustomValidators: true,
  enableConditionalValidation: true,
  maxSchemaDepth: 10,
  enableCaching: false,
  strictMode: false,
};

/**
 * Built-in field types with default configurations
 */
const FIELD_TYPES = {
  // Basic types
  STRING: 'string',
  NUMBER: 'number', 
  BOOLEAN: 'boolean',
  DATE: 'date',
  ARRAY: 'array',
  OBJECT: 'object',
  
  // Domain-specific types
  EMAIL: 'email',
  PHONE: 'phone',
  MONGO_ID: 'mongoId',
  URL: 'url',
  UUID: 'uuid',
  
  // Business types
  MONEY: 'money',
  PERCENTAGE: 'percentage',
  COORDINATES: 'coordinates',
  
  // Indian-specific types
  PINCODE: 'pincode',
  GSTIN: 'gstin',
  PAN: 'pan',
  AADHAR: 'aadhar',
};

/**
 * Common validation constraints
 */
const CONSTRAINTS = {
  // String constraints
  MIN_LENGTH: 'minLength',
  MAX_LENGTH: 'maxLength',
  PATTERN: 'pattern',
  
  // Number constraints
  MIN_VALUE: 'min',
  MAX_VALUE: 'max',
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  INTEGER: 'int',
  
  // Array constraints
  MIN_ITEMS: 'minItems',
  MAX_ITEMS: 'maxItems',
  UNIQUE_ITEMS: 'unique',
  
  // General constraints
  REQUIRED: 'required',
  OPTIONAL: 'optional',
  NULLABLE: 'nullable',
  DEFAULT: 'default',
  ENUM: 'enum',
};

// ─── Core Schema Builder Class ──────────────────────────────────────────────────

/**
 * Dynamic schema builder for flexible validation schema creation
 */
class SchemaBuilder {
  constructor(config = {}) {
    this.config = { ...DEFAULT_BUILDER_CONFIG, ...config };
    this.schemaCache = new Map();
    this.customValidators = new Map();
    this.transforms = new Map();
    this.conditionalRules = new Map();
  }
  
  /**
   * Create a new field schema with specified type and constraints
   * 
   * @param {string} type - Field type from FIELD_TYPES
   * @param {Object} constraints - Validation constraints
   * @param {Object} options - Additional options
   * @returns {z.ZodSchema} Zod schema for the field
   */
  field(type, constraints = {}, options = {}) {
    const cacheKey = this._getCacheKey('field', { type, constraints, options });
    
    if (this.config.enableCaching && this.schemaCache.has(cacheKey)) {
      return this.schemaCache.get(cacheKey);
    }
    
    let schema = this._createBaseSchema(type);
    schema = this._applyConstraints(schema, constraints, type);
    schema = this._applyTransforms(schema, options.transforms);
    schema = this._applyCustomValidators(schema, options.validators);
    
    if (this.config.enableCaching) {
      this.schemaCache.set(cacheKey, schema);
    }
    
    return schema;
  }
  
  /**
   * Create an object schema with multiple fields
   * 
   * @param {Object} fields - Object with field definitions
   * @param {Object} options - Schema options
   * @returns {z.ZodObject} Zod object schema
   */
  object(fields, options = {}) {
    const cacheKey = this._getCacheKey('object', { fields, options });
    
    if (this.config.enableCaching && this.schemaCache.has(cacheKey)) {
      return this.schemaCache.get(cacheKey);
    }
    
    const schemaFields = {};
    
    // Build individual field schemas
    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      if (typeof fieldDef === 'string') {
        // Simple type definition
        schemaFields[fieldName] = this.field(fieldDef);
      } else if (fieldDef.type) {
        // Full field definition
        schemaFields[fieldName] = this.field(
          fieldDef.type,
          fieldDef.constraints || {},
          fieldDef.options || {}
        );
      } else if (fieldDef.schema) {
        // Direct schema provided
        schemaFields[fieldName] = fieldDef.schema;
      }
    }
    
    let schema = z.object(schemaFields);
    
    // Apply object-level options
    if (options.strict === true) {
      schema = schema.strict();
    }
    
    if (options.passthrough === true) {
      schema = schema.passthrough();
    }
    
    if (options.strip === true) {
      schema = schema.strip();
    }
    
    // Apply conditional validation rules
    if (options.conditionalRules) {
      schema = this._applyConditionalRules(schema, options.conditionalRules);
    }
    
    if (this.config.enableCaching) {
      this.schemaCache.set(cacheKey, schema);
    }
    
    return schema;
  }
  
  /**
   * Create an array schema with item validation
   * 
   * @param {string|Object|z.ZodSchema} itemType - Type or schema for array items
   * @param {Object} constraints - Array constraints
   * @param {Object} options - Additional options
   * @returns {z.ZodArray} Zod array schema
   */
  array(itemType, constraints = {}, options = {}) {
    let itemSchema;
    
    if (typeof itemType === 'string') {
      itemSchema = this.field(itemType);
    } else if (itemType.type) {
      itemSchema = this.field(itemType.type, itemType.constraints, itemType.options);
    } else {
      itemSchema = itemType; // Assume it's already a Zod schema
    }
    
    let schema = z.array(itemSchema);
    
    // Apply array constraints
    if (constraints.minItems !== undefined) {
      schema = schema.min(constraints.minItems);
    }
    
    if (constraints.maxItems !== undefined) {
      schema = schema.max(constraints.maxItems);
    }
    
    if (constraints.unique === true) {
      schema = schema.refine(
        (items) => new Set(items).size === items.length,
        { message: 'Array items must be unique' }
      );
    }
    
    return schema;
  }
  
  /**
   * Create conditional validation schema based on other field values
   * 
   * @param {Object} conditions - Conditional validation rules
   * @param {z.ZodSchema} baseSchema - Base schema to extend
   * @returns {z.ZodSchema} Schema with conditional validation
   */
  conditional(conditions, baseSchema) {
    if (!this.config.enableConditionalValidation) {
      return baseSchema;
    }
    
    let schema = baseSchema;
    
    for (const [condition, rule] of Object.entries(conditions)) {
      const [field, operator, value] = this._parseCondition(condition);
      
      schema = schema.refine((data) => {
        const fieldValue = this._getNestedValue(data, field);
        const conditionMet = this._evaluateCondition(fieldValue, operator, value);
        
        if (conditionMet) {
          // Apply conditional rule
          if (rule.required) {
            for (const requiredField of rule.required) {
              const requiredValue = this._getNestedValue(data, requiredField);
              if (requiredValue === undefined || requiredValue === null) {
                return false;
              }
            }
          }
          
          if (rule.validate) {
            return rule.validate(data);
          }
        }
        
        return true;
      }, rule.message || 'Conditional validation failed');
    }
    
    return schema;
  }
  
  /**
   * Create union schema for multiple possible types
   * 
   * @param {Array<string|Object|z.ZodSchema>} types - Array of possible types
   * @param {Object} options - Union options
   * @returns {z.ZodUnion} Zod union schema
   */
  union(types, options = {}) {
    const schemas = types.map(type => {
      if (typeof type === 'string') {
        return this.field(type);
      } else if (type.type) {
        return this.field(type.type, type.constraints, type.options);
      } else {
        return type; // Assume it's already a Zod schema
      }
    });
    
    return z.union(schemas);
  }
  
  /**
   * Add custom validator function
   * 
   * @param {string} name - Validator name
   * @param {Function} validator - Validation function
   * @param {string} message - Error message
   */
  addValidator(name, validator, message) {
    this.customValidators.set(name, { validator, message });
  }
  
  /**
   * Add custom transform function
   * 
   * @param {string} name - Transform name
   * @param {Function} transform - Transform function
   */
  addTransform(name, transform) {
    this.transforms.set(name, transform);
  }
  
  /**
   * Clear schema cache
   */
  clearCache() {
    this.schemaCache.clear();
  }
  
  /**
   * Get cache statistics
   * 
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.schemaCache.size,
      customValidators: this.customValidators.size,
      transforms: this.transforms.size,
    };
  }
  
  // ─── Private Methods ──────────────────────────────────────────────────────────
  
  /**
   * Create base schema for given type
   * @private
   */
  _createBaseSchema(type) {
    switch (type) {
      case FIELD_TYPES.STRING:
        return z.string();
      
      case FIELD_TYPES.NUMBER:
        return z.number();
      
      case FIELD_TYPES.BOOLEAN:
        return z.boolean();
      
      case FIELD_TYPES.DATE:
        return z.date();
      
      case FIELD_TYPES.EMAIL:
        return z.string().email();
      
      case FIELD_TYPES.PHONE:
        return z.string().regex(
          /^(?:\+91|91)?[6-9]\d{9}$/,
          'Invalid phone number format'
        );
      
      case FIELD_TYPES.MONGO_ID:
        return z.string().regex(
          /^[a-f\d]{24}$/i,
          'Invalid MongoDB ObjectId'
        );
      
      case FIELD_TYPES.URL:
        return z.string().url();
      
      case FIELD_TYPES.UUID:
        return z.string().uuid();
      
      case FIELD_TYPES.MONEY:
        return z.number().positive().multipleOf(0.01);
      
      case FIELD_TYPES.PERCENTAGE:
        return z.number().min(0).max(100);
      
      case FIELD_TYPES.COORDINATES:
        return z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        });
      
      case FIELD_TYPES.PINCODE:
        return z.string().regex(
          /^[1-9][0-9]{5}$/,
          'Invalid Indian PIN code'
        );
      
      case FIELD_TYPES.GSTIN:
        return z.string().regex(
          /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
          'Invalid GSTIN format'
        );
      
      case FIELD_TYPES.PAN:
        return z.string().regex(
          /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
          'Invalid PAN number format'
        );
      
      case FIELD_TYPES.AADHAR:
        return z.string().regex(
          /^[2-9]{1}[0-9]{3}[0-9]{4}[0-9]{4}$/,
          'Invalid Aadhar number format'
        );
      
      default:
        return z.string(); // Default to string type
    }
  }
  
  /**
   * Apply constraints to schema
   * @private
   */
  _applyConstraints(schema, constraints, type) {
    let result = schema;
    
    // String-specific constraints
    if (type === FIELD_TYPES.STRING || type === FIELD_TYPES.EMAIL) {
      if (constraints.minLength !== undefined) {
        result = result.min(constraints.minLength);
      }
      
      if (constraints.maxLength !== undefined) {
        result = result.max(constraints.maxLength);
      }
      
      if (constraints.pattern) {
        result = result.regex(
          new RegExp(constraints.pattern),
          constraints.patternMessage || 'Invalid format'
        );
      }
      
      if (constraints.trim === true) {
        result = result.trim();
      }
    }
    
    // Number-specific constraints
    if (type === FIELD_TYPES.NUMBER || type === FIELD_TYPES.MONEY || type === FIELD_TYPES.PERCENTAGE) {
      if (constraints.min !== undefined) {
        result = result.min(constraints.min);
      }
      
      if (constraints.max !== undefined) {
        result = result.max(constraints.max);
      }
      
      if (constraints.positive === true) {
        result = result.positive();
      }
      
      if (constraints.negative === true) {
        result = result.negative();
      }
      
      if (constraints.integer === true) {
        result = result.int();
      }
      
      if (constraints.multipleOf !== undefined) {
        result = result.multipleOf(constraints.multipleOf);
      }
    }
    
    // General constraints
    if (constraints.required === false || constraints.optional === true) {
      result = result.optional();
    }
    
    if (constraints.nullable === true) {
      result = result.nullable();
    }
    
    if (constraints.default !== undefined) {
      result = result.default(constraints.default);
    }
    
    if (constraints.enum) {
      result = result.refine(
        (value) => constraints.enum.includes(value),
        `Value must be one of: ${constraints.enum.join(', ')}`
      );
    }
    
    return result;
  }
  
  /**
   * Apply custom transforms to schema
   * @private
   */
  _applyTransforms(schema, transforms) {
    if (!transforms || !this.config.enableTransformations) {
      return schema;
    }
    
    let result = schema;
    
    for (const transformName of transforms) {
      if (this.transforms.has(transformName)) {
        result = result.transform(this.transforms.get(transformName));
      }
    }
    
    return result;
  }
  
  /**
   * Apply custom validators to schema
   * @private
   */
  _applyCustomValidators(schema, validators) {
    if (!validators || !this.config.enableCustomValidators) {
      return schema;
    }
    
    let result = schema;
    
    for (const validatorName of validators) {
      if (this.customValidators.has(validatorName)) {
        const { validator, message } = this.customValidators.get(validatorName);
        result = result.refine(validator, message);
      }
    }
    
    return result;
  }
  
  /**
   * Apply conditional validation rules
   * @private
   */
  _applyConditionalRules(schema, rules) {
    let result = schema;
    
    for (const rule of rules) {
      result = result.refine((data) => {
        const conditionMet = this._evaluateCondition(
          this._getNestedValue(data, rule.field),
          rule.operator,
          rule.value
        );
        
        if (conditionMet && rule.then) {
          return rule.then(data);
        }
        
        if (!conditionMet && rule.else) {
          return rule.else(data);
        }
        
        return true;
      }, rule.message || 'Conditional validation failed');
    }
    
    return result;
  }
  
  /**
   * Generate cache key for schema caching
   * @private
   */
  _getCacheKey(type, params) {
    return `${type}_${JSON.stringify(params)}`;
  }
  
  /**
   * Parse condition string
   * @private
   */
  _parseCondition(condition) {
    const parts = condition.split(/\s+(===|==|!=|!==|>|>=|<|<=)\s+/);
    return [parts[0], parts[1], parts[2]];
  }
  
  /**
   * Evaluate conditional expression
   * @private
   */
  _evaluateCondition(fieldValue, operator, expectedValue) {
    switch (operator) {
      case '===':
      case '==':
        return fieldValue === expectedValue;
      case '!==':
      case '!=':
        return fieldValue !== expectedValue;
      case '>':
        return fieldValue > expectedValue;
      case '>=':
        return fieldValue >= expectedValue;
      case '<':
        return fieldValue < expectedValue;
      case '<=':
        return fieldValue <= expectedValue;
      default:
        return false;
    }
  }
  
  /**
   * Get nested object value by path
   * @private
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}

// ─── Factory Functions ──────────────────────────────────────────────────────────

/**
 * Create a new schema builder instance
 * 
 * @param {Object} config - Builder configuration
 * @returns {SchemaBuilder} New schema builder instance
 */
function createSchemaBuilder(config = {}) {
  return new SchemaBuilder(config);
}

/**
 * Create a quick field schema without builder instance
 * 
 * @param {string} type - Field type
 * @param {Object} constraints - Field constraints
 * @param {Object} options - Additional options
 * @returns {z.ZodSchema} Zod schema
 */
function quickField(type, constraints = {}, options = {}) {
  const builder = new SchemaBuilder();
  return builder.field(type, constraints, options);
}

/**
 * Create a quick object schema without builder instance
 * 
 * @param {Object} fields - Object field definitions
 * @param {Object} options - Schema options
 * @returns {z.ZodObject} Zod object schema
 */
function quickObject(fields, options = {}) {
  const builder = new SchemaBuilder();
  return builder.object(fields, options);
}

/**
 * Create a pagination schema with standard fields
 * 
 * @param {Object} options - Pagination options
 * @returns {z.ZodObject} Pagination schema
 */
function createPaginationSchema(options = {}) {
  const defaults = {
    maxLimit: 100,
    defaultLimit: 10,
    defaultPage: 1,
  };
  
  const config = { ...defaults, ...options };
  
  return quickObject({
    page: {
      type: FIELD_TYPES.NUMBER,
      constraints: {
        min: 1,
        integer: true,
        default: config.defaultPage,
      },
    },
    limit: {
      type: FIELD_TYPES.NUMBER,
      constraints: {
        min: 1,
        max: config.maxLimit,
        integer: true,
        default: config.defaultLimit,
      },
    },
    sort: {
      type: FIELD_TYPES.STRING,
      constraints: {
        optional: true,
        maxLength: 50,
      },
    },
    order: {
      type: FIELD_TYPES.STRING,
      constraints: {
        enum: ['asc', 'desc'],
        default: 'desc',
      },
    },
  });
}

/**
 * Create address validation schema for Indian addresses
 * 
 * @param {Object} options - Address validation options
 * @returns {z.ZodObject} Address schema
 */
function createAddressSchema(options = {}) {
  return quickObject({
    addressLine1: {
      type: FIELD_TYPES.STRING,
      constraints: {
        minLength: 5,
        maxLength: 100,
        trim: true,
      },
    },
    addressLine2: {
      type: FIELD_TYPES.STRING,
      constraints: {
        optional: true,
        maxLength: 100,
        trim: true,
      },
    },
    city: {
      type: FIELD_TYPES.STRING,
      constraints: {
        minLength: 2,
        maxLength: 50,
        trim: true,
      },
    },
    state: {
      type: FIELD_TYPES.STRING,
      constraints: {
        minLength: 2,
        maxLength: 50,
        trim: true,
      },
    },
    pincode: {
      type: FIELD_TYPES.PINCODE,
    },
    country: {
      type: FIELD_TYPES.STRING,
      constraints: {
        default: 'India',
        maxLength: 50,
      },
    },
    landmark: {
      type: FIELD_TYPES.STRING,
      constraints: {
        optional: true,
        maxLength: 100,
        trim: true,
      },
    },
  });
}

/**
 * Create contact information schema
 * 
 * @param {Object} options - Contact validation options
 * @returns {z.ZodObject} Contact schema
 */
function createContactSchema(options = {}) {
  return quickObject({
    name: {
      type: FIELD_TYPES.STRING,
      constraints: {
        minLength: 2,
        maxLength: 100,
        trim: true,
      },
    },
    email: {
      type: FIELD_TYPES.EMAIL,
      constraints: {
        optional: options.requireEmail === false,
      },
    },
    phone: {
      type: FIELD_TYPES.PHONE,
      constraints: {
        optional: options.requirePhone === false,
      },
    },
    alternatePhone: {
      type: FIELD_TYPES.PHONE,
      constraints: {
        optional: true,
      },
    },
  });
}

// ─── Main Exports ───────────────────────────────────────────────────────────────

module.exports = {
  // Main class and factory functions
  SchemaBuilder,
  createSchemaBuilder,
  
  // Quick utility functions
  quickField,
  quickObject,
  
  // Specialized schema creators
  createPaginationSchema,
  createAddressSchema,
  createContactSchema,
  
  // Constants
  FIELD_TYPES,
  CONSTRAINTS,
  DEFAULT_BUILDER_CONFIG,
  
  // Direct field creation functions for common types
  stringField: (constraints, options) => quickField(FIELD_TYPES.STRING, constraints, options),
  numberField: (constraints, options) => quickField(FIELD_TYPES.NUMBER, constraints, options),
  emailField: (constraints, options) => quickField(FIELD_TYPES.EMAIL, constraints, options),
  phoneField: (constraints, options) => quickField(FIELD_TYPES.PHONE, constraints, options),
  mongoIdField: (constraints, options) => quickField(FIELD_TYPES.MONGO_ID, constraints, options),
  moneyField: (constraints, options) => quickField(FIELD_TYPES.MONEY, constraints, options),
  pincodeField: (constraints, options) => quickField(FIELD_TYPES.PINCODE, constraints, options),
  dateField: (constraints, options) => quickField(FIELD_TYPES.DATE, constraints, options),
  booleanField: (constraints, options) => quickField(FIELD_TYPES.BOOLEAN, constraints, options),
};