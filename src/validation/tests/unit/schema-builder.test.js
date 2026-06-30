'use strict';

/**
 * Unit Tests for Schema Builder Helper
 * 
 * Tests dynamic schema construction, field building, conditional validation,
 * and schema composition utilities.
 */

const { z } = require('zod');
const {
  SchemaBuilder,
  createSchemaBuilder,
  quickField,
  quickObject,
  createPaginationSchema,
  createAddressSchema,
  createContactSchema,
  FIELD_TYPES,
  CONSTRAINTS,
  stringField,
  numberField,
  emailField,
  phoneField,
  mongoIdField,
  moneyField,
  pincodeField,
} = require('../../helpers/schema-builder');

describe('Schema Builder Helper', () => {
  describe('SchemaBuilder Class', () => {
    let builder;
    
    beforeEach(() => {
      builder = new SchemaBuilder();
    });
    
    describe('field() method', () => {
      test('should create basic string field', () => {
        const schema = builder.field(FIELD_TYPES.STRING);
        
        expect(schema).toBeInstanceOf(z.ZodString);
        expect(schema.safeParse('test').success).toBe(true);
        expect(schema.safeParse(123).success).toBe(false);
      });
      
      test('should create field with constraints', () => {
        const schema = builder.field(FIELD_TYPES.STRING, {
          minLength: 2,
          maxLength: 10,
          trim: true,
        });
        
        expect(schema.safeParse('ab').success).toBe(true);
        expect(schema.safeParse('a').success).toBe(false); // Too short
        expect(schema.safeParse('a'.repeat(11)).success).toBe(false); // Too long
      });
      
      test('should create number field with constraints', () => {
        const schema = builder.field(FIELD_TYPES.NUMBER, {
          min: 0,
          max: 100,
          integer: true,
        });
        
        expect(schema.safeParse(50).success).toBe(true);
        expect(schema.safeParse(-1).success).toBe(false); // Below min
        expect(schema.safeParse(101).success).toBe(false); // Above max
        expect(schema.safeParse(50.5).success).toBe(false); // Not integer
      });
      
      test('should create email field', () => {
        const schema = builder.field(FIELD_TYPES.EMAIL);
        
        expect(schema.safeParse('test@example.com').success).toBe(true);
        expect(schema.safeParse('invalid-email').success).toBe(false);
      });
      
      test('should create phone field', () => {
        const schema = builder.field(FIELD_TYPES.PHONE);
        
        expect(schema.safeParse('9876543210').success).toBe(true);
        expect(schema.safeParse('+919876543210').success).toBe(true);
        expect(schema.safeParse('123456').success).toBe(false);
      });
      
      test('should create MongoDB ObjectId field', () => {
        const schema = builder.field(FIELD_TYPES.MONGO_ID);
        
        expect(schema.safeParse('507f1f77bcf86cd799439011').success).toBe(true);
        expect(schema.safeParse('invalid-id').success).toBe(false);
      });
      
      test('should create money field', () => {
        const schema = builder.field(FIELD_TYPES.MONEY);
        
        expect(schema.safeParse(99.99).success).toBe(true);
        expect(schema.safeParse(0.01).success).toBe(true);
        expect(schema.safeParse(-10).success).toBe(false); // Negative
        expect(schema.safeParse(99.999).success).toBe(false); // Too many decimals
      });
      
      test('should create PIN code field', () => {
        const schema = builder.field(FIELD_TYPES.PINCODE);
        
        expect(schema.safeParse('560001').success).toBe(true);
        expect(schema.safeParse('110001').success).toBe(true);
        expect(schema.safeParse('000001').success).toBe(false); // Invalid first digit
        expect(schema.safeParse('12345').success).toBe(false); // Too short
      });
      
      test('should handle optional fields', () => {
        const schema = builder.field(FIELD_TYPES.STRING, {
          optional: true,
        });
        
        expect(schema.safeParse(undefined).success).toBe(true);
        expect(schema.safeParse('test').success).toBe(true);
      });
      
      test('should handle nullable fields', () => {
        const schema = builder.field(FIELD_TYPES.STRING, {
          nullable: true,
        });
        
        expect(schema.safeParse(null).success).toBe(true);
        expect(schema.safeParse('test').success).toBe(true);
      });
      
      test('should handle default values', () => {
        const schema = builder.field(FIELD_TYPES.STRING, {
          default: 'default-value',
        });
        
        const result = schema.safeParse(undefined);
        expect(result.success).toBe(true);
        expect(result.data).toBe('default-value');
      });
      
      test('should handle enum constraints', () => {
        const schema = builder.field(FIELD_TYPES.STRING, {
          enum: ['active', 'inactive', 'pending'],
        });
        
        expect(schema.safeParse('active').success).toBe(true);
        expect(schema.safeParse('invalid').success).toBe(false);
      });
    });
    
    describe('object() method', () => {
      test('should create object schema with string field definitions', () => {
        const schema = builder.object({
          name: FIELD_TYPES.STRING,
          age: FIELD_TYPES.NUMBER,
          email: FIELD_TYPES.EMAIL,
        });
        
        const validData = {
          name: 'John Doe',
          age: 30,
          email: 'john@example.com',
        };
        
        expect(schema.safeParse(validData).success).toBe(true);
      });
      
      test('should create object schema with full field definitions', () => {
        const schema = builder.object({
          name: {
            type: FIELD_TYPES.STRING,
            constraints: {
              minLength: 2,
              maxLength: 50,
            },
          },
          age: {
            type: FIELD_TYPES.NUMBER,
            constraints: {
              min: 0,
              max: 120,
            },
          },
        });
        
        const validData = { name: 'John', age: 30 };
        const invalidData = { name: 'A', age: 150 };
        
        expect(schema.safeParse(validData).success).toBe(true);
        expect(schema.safeParse(invalidData).success).toBe(false);
      });
      
      test('should handle direct schema definitions', () => {
        const schema = builder.object({
          customField: {
            schema: z.string().regex(/^[A-Z]{2}\d{4}$/),
          },
        });
        
        expect(schema.safeParse({ customField: 'AB1234' }).success).toBe(true);
        expect(schema.safeParse({ customField: 'invalid' }).success).toBe(false);
      });
      
      test('should apply object-level options', () => {
        const strictSchema = builder.object({
          name: FIELD_TYPES.STRING,
        }, { strict: true });
        
        // Strict schema should reject unknown fields
        expect(strictSchema.safeParse({ name: 'John' }).success).toBe(true);
        expect(strictSchema.safeParse({ name: 'John', extra: 'field' }).success).toBe(false);
      });
    });
    
    describe('array() method', () => {
      test('should create array schema with string item type', () => {
        const schema = builder.array(FIELD_TYPES.STRING);
        
        expect(schema.safeParse(['a', 'b', 'c']).success).toBe(true);
        expect(schema.safeParse(['a', 1, 'c']).success).toBe(false);
      });
      
      test('should create array schema with item definition', () => {
        const schema = builder.array({
          type: FIELD_TYPES.STRING,
          constraints: {
            minLength: 2,
          },
        });
        
        expect(schema.safeParse(['ab', 'cd']).success).toBe(true);
        expect(schema.safeParse(['a', 'b']).success).toBe(false);
      });
      
      test('should apply array constraints', () => {
        const schema = builder.array(FIELD_TYPES.STRING, {
          minItems: 2,
          maxItems: 5,
          unique: true,
        });
        
        expect(schema.safeParse(['a', 'b']).success).toBe(true);
        expect(schema.safeParse(['a']).success).toBe(false); // Too few items
        expect(schema.safeParse(['a', 'b', 'c', 'd', 'e', 'f']).success).toBe(false); // Too many items
        expect(schema.safeParse(['a', 'a']).success).toBe(false); // Not unique
      });
    });
    
    describe('union() method', () => {
      test('should create union schema', () => {
        const schema = builder.union([
          FIELD_TYPES.STRING,
          FIELD_TYPES.NUMBER,
        ]);
        
        expect(schema.safeParse('test').success).toBe(true);
        expect(schema.safeParse(123).success).toBe(true);
        expect(schema.safeParse(true).success).toBe(false);
      });
      
      test('should create union with field definitions', () => {
        const schema = builder.union([
          {
            type: FIELD_TYPES.STRING,
            constraints: { minLength: 5 },
          },
          {
            type: FIELD_TYPES.NUMBER,
            constraints: { min: 0 },
          },
        ]);
        
        expect(schema.safeParse('hello').success).toBe(true);
        expect(schema.safeParse(42).success).toBe(true);
        expect(schema.safeParse('hi').success).toBe(false); // String too short
        expect(schema.safeParse(-1).success).toBe(false); // Number below min
      });
    });
    
    describe('Custom Validators and Transforms', () => {
      test('should add and use custom validators', () => {
        builder.addValidator(
          'isEven',
          (value) => value % 2 === 0,
          'Number must be even'
        );
        
        const schema = builder.field(FIELD_TYPES.NUMBER, {}, {
          validators: ['isEven'],
        });
        
        expect(schema.safeParse(4).success).toBe(true);
        expect(schema.safeParse(3).success).toBe(false);
      });
      
      test('should add and use custom transforms', () => {
        builder.addTransform('uppercase', (value) => value.toUpperCase());
        
        const schema = builder.field(FIELD_TYPES.STRING, {}, {
          transforms: ['uppercase'],
        });
        
        const result = schema.safeParse('hello');
        expect(result.success).toBe(true);
        expect(result.data).toBe('HELLO');
      });
    });
    
    describe('Caching', () => {
      test('should cache schemas when caching is enabled', () => {
        const cachedBuilder = new SchemaBuilder({ enableCaching: true });
        
        const schema1 = cachedBuilder.field(FIELD_TYPES.STRING, { minLength: 5 });
        const schema2 = cachedBuilder.field(FIELD_TYPES.STRING, { minLength: 5 });
        
        // Should return same instance when cached
        expect(schema1).toBe(schema2);
        
        const stats = cachedBuilder.getCacheStats();
        expect(stats.size).toBeGreaterThan(0);
      });
      
      test('should clear cache', () => {
        const cachedBuilder = new SchemaBuilder({ enableCaching: true });
        
        cachedBuilder.field(FIELD_TYPES.STRING);
        expect(cachedBuilder.getCacheStats().size).toBeGreaterThan(0);
        
        cachedBuilder.clearCache();
        expect(cachedBuilder.getCacheStats().size).toBe(0);
      });
    });
  });
  
  describe('Factory Functions', () => {
    test('should create schema builder', () => {
      const builder = createSchemaBuilder({
        enableCaching: true,
        strictMode: true,
      });
      
      expect(builder).toBeInstanceOf(SchemaBuilder);
      expect(builder.config.enableCaching).toBe(true);
      expect(builder.config.strictMode).toBe(true);
    });
    
    test('should create quick field', () => {
      const schema = quickField(FIELD_TYPES.EMAIL);
      
      expect(schema.safeParse('test@example.com').success).toBe(true);
      expect(schema.safeParse('invalid').success).toBe(false);
    });
    
    test('should create quick object', () => {
      const schema = quickObject({
        name: FIELD_TYPES.STRING,
        email: FIELD_TYPES.EMAIL,
      });
      
      const validData = { name: 'John', email: 'john@example.com' };
      expect(schema.safeParse(validData).success).toBe(true);
    });
  });
  
  describe('Specialized Schema Creators', () => {
    describe('createPaginationSchema', () => {
      test('should create pagination schema with defaults', () => {
        const schema = createPaginationSchema();
        
        const validData = { page: 1, limit: 10, sort: 'created', order: 'desc' };
        expect(schema.safeParse(validData).success).toBe(true);
        
        // Should apply defaults
        const result = schema.safeParse({});
        expect(result.success).toBe(true);
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
        expect(result.data.order).toBe('desc');
      });
      
      test('should enforce pagination constraints', () => {
        const schema = createPaginationSchema({ maxLimit: 50 });
        
        expect(schema.safeParse({ page: 0 }).success).toBe(false); // Invalid page
        expect(schema.safeParse({ limit: 100 }).success).toBe(false); // Exceeds max limit
        expect(schema.safeParse({ order: 'invalid' }).success).toBe(false); // Invalid order
      });
    });
    
    describe('createAddressSchema', () => {
      test('should create Indian address schema', () => {
        const schema = createAddressSchema();
        
        const validAddress = {
          addressLine1: '123 Main Street',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560001',
          country: 'India',
        };
        
        expect(schema.safeParse(validAddress).success).toBe(true);
        
        // Should apply defaults
        const result = schema.safeParse({
          addressLine1: '123 Main Street',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560001',
        });
        expect(result.success).toBe(true);
        expect(result.data.country).toBe('India');
      });
      
      test('should validate address constraints', () => {
        const schema = createAddressSchema();
        
        // Invalid PIN code
        expect(schema.safeParse({
          addressLine1: '123 Main Street',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '000001', // Invalid first digit
        }).success).toBe(false);
        
        // Address line too short
        expect(schema.safeParse({
          addressLine1: 'ABC', // Too short
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560001',
        }).success).toBe(false);
      });
    });
    
    describe('createContactSchema', () => {
      test('should create contact schema', () => {
        const schema = createContactSchema();
        
        const validContact = {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '9876543210',
        };
        
        expect(schema.safeParse(validContact).success).toBe(true);
      });
      
      test('should handle optional fields', () => {
        const schema = createContactSchema({
          requireEmail: false,
          requirePhone: false,
        });
        
        const minimalContact = { name: 'John Doe' };
        expect(schema.safeParse(minimalContact).success).toBe(true);
      });
    });
  });
  
  describe('Direct Field Functions', () => {
    test('should create string field directly', () => {
      const schema = stringField({ minLength: 5 });
      
      expect(schema.safeParse('hello').success).toBe(true);
      expect(schema.safeParse('hi').success).toBe(false);
    });
    
    test('should create number field directly', () => {
      const schema = numberField({ min: 0, max: 100 });
      
      expect(schema.safeParse(50).success).toBe(true);
      expect(schema.safeParse(-1).success).toBe(false);
    });
    
    test('should create email field directly', () => {
      const schema = emailField();
      
      expect(schema.safeParse('test@example.com').success).toBe(true);
      expect(schema.safeParse('invalid').success).toBe(false);
    });
    
    test('should create phone field directly', () => {
      const schema = phoneField();
      
      expect(schema.safeParse('9876543210').success).toBe(true);
      expect(schema.safeParse('123').success).toBe(false);
    });
    
    test('should create MongoDB ID field directly', () => {
      const schema = mongoIdField();
      
      expect(schema.safeParse('507f1f77bcf86cd799439011').success).toBe(true);
      expect(schema.safeParse('invalid').success).toBe(false);
    });
    
    test('should create money field directly', () => {
      const schema = moneyField();
      
      expect(schema.safeParse(99.99).success).toBe(true);
      expect(schema.safeParse(-10).success).toBe(false);
    });
    
    test('should create PIN code field directly', () => {
      const schema = pincodeField();
      
      expect(schema.safeParse('560001').success).toBe(true);
      expect(schema.safeParse('000001').success).toBe(false);
    });
  });
  
  describe('Field Types and Constraints', () => {
    test('should have all expected field types', () => {
      expect(FIELD_TYPES.STRING).toBe('string');
      expect(FIELD_TYPES.NUMBER).toBe('number');
      expect(FIELD_TYPES.EMAIL).toBe('email');
      expect(FIELD_TYPES.PHONE).toBe('phone');
      expect(FIELD_TYPES.MONGO_ID).toBe('mongoId');
      expect(FIELD_TYPES.MONEY).toBe('money');
      expect(FIELD_TYPES.PINCODE).toBe('pincode');
    });
    
    test('should have all expected constraints', () => {
      expect(CONSTRAINTS.MIN_LENGTH).toBe('minLength');
      expect(CONSTRAINTS.MAX_LENGTH).toBe('maxLength');
      expect(CONSTRAINTS.REQUIRED).toBe('required');
      expect(CONSTRAINTS.OPTIONAL).toBe('optional');
      expect(CONSTRAINTS.DEFAULT).toBe('default');
    });
  });
});