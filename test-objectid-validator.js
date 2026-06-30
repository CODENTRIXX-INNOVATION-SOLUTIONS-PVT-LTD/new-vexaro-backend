/**
 * ObjectId Validator Demo Script
 * 
 * Demonstrates the ObjectId validator functionality
 */

const {
  validateObjectId,
  normalizeObjectId,
  isValidObjectId,
  getObjectIdTimestamp,
  compareObjectIds,
  createObjectIdSchema,
  OBJECTID_ERROR_CODES
} = require('./src/validation/index.js');

const mongoose = require('mongoose');

console.log('=== MongoDB ObjectId Validator Demo ===\n');

// Test 1: Valid ObjectId
console.log('1. Validating a valid ObjectId:');
const validId = '507f1f77bcf86cd799439011';
const result1 = validateObjectId(validId);
console.log(`   Input: ${validId}`);
console.log(`   Valid: ${result1.isValid}`);
console.log(`   Timestamp: ${result1.timestamp}`);
console.log(`   Mongoose Compatible: ${result1.mongooseCompatible}\n`);

// Test 2: Uppercase ObjectId (normalization)
console.log('2. Normalizing uppercase ObjectId:');
const uppercaseId = '507F1F77BCF86CD799439011';
const result2 = normalizeObjectId(uppercaseId);
console.log(`   Input: ${uppercaseId}`);
console.log(`   Normalized: ${result2.normalized}`);
console.log(`   Valid: ${result2.isValid}\n`);

// Test 3: Invalid ObjectId (wrong length)
console.log('3. Validating invalid ObjectId (too short):');
const invalidId = '507f1f77bcf86cd7994390';
const result3 = validateObjectId(invalidId);
console.log(`   Input: ${invalidId}`);
console.log(`   Valid: ${result3.isValid}`);
console.log(`   Error: ${result3.error}`);
console.log(`   Message: ${result3.message}\n`);

// Test 4: Invalid ObjectId (invalid characters)
console.log('4. Validating invalid ObjectId (invalid character):');
const invalidChars = '507f1f77bcf86cd79943901g';
const result4 = validateObjectId(invalidChars);
console.log(`   Input: ${invalidChars}`);
console.log(`   Valid: ${result4.isValid}`);
console.log(`   Error: ${result4.error}\n`);

// Test 5: Mongoose ObjectId instance
console.log('5. Validating Mongoose ObjectId instance:');
const mongooseId = new mongoose.Types.ObjectId();
const result5 = validateObjectId(mongooseId);
console.log(`   Input: [Mongoose ObjectId]`);
console.log(`   Valid: ${result5.isValid}`);
console.log(`   Is Mongoose Instance: ${result5.isMongooseInstance}`);
console.log(`   Normalized: ${result5.normalized}\n`);

// Test 6: Get timestamp from ObjectId
console.log('6. Extracting timestamp from ObjectId:');
const timestamp = getObjectIdTimestamp(validId);
console.log(`   ObjectId: ${validId}`);
console.log(`   Created at: ${timestamp}`);
console.log(`   Year: ${timestamp.getFullYear()}\n`);

// Test 7: Compare ObjectIds
console.log('7. Comparing ObjectIds:');
const id1 = '507f1f77bcf86cd799439011';
const id2 = '507F1F77BCF86CD799439011'; // Same, but uppercase
const id3 = '507f191e810c19729de860ea'; // Different
console.log(`   ID1: ${id1}`);
console.log(`   ID2: ${id2} (uppercase)`);
console.log(`   ID3: ${id3} (different)`);
console.log(`   ID1 == ID2: ${compareObjectIds(id1, id2)}`);
console.log(`   ID1 == ID3: ${compareObjectIds(id1, id3)}\n`);

// Test 8: Quick validation check
console.log('8. Quick boolean validation checks:');
console.log(`   isValidObjectId('${validId}'): ${isValidObjectId(validId)}`);
console.log(`   isValidObjectId('${invalidId}'): ${isValidObjectId(invalidId)}`);
console.log(`   isValidObjectId('invalid'): ${isValidObjectId('invalid')}\n`);

// Test 9: Zod schema integration
console.log('9. Zod schema integration:');
const z = require('zod');
const objectIdSchema = createObjectIdSchema();
try {
  const parsed = objectIdSchema.parse(uppercaseId);
  console.log(`   Input: ${uppercaseId}`);
  console.log(`   Parsed: ${parsed}`);
  console.log(`   Valid: true\n`);
} catch (error) {
  console.log(`   Valid: false`);
  console.log(`   Error: ${error.message}\n`);
}

console.log('=== Demo Complete ===');
