const fc = require('fast-check');
const { mongoIdSchema } = require('../../src/utils/validation');

describe('mongoIdSchema', () => {
  // 1. Valid 24-char lowercase hex
  it('accepts a valid 24-char lowercase hex string', () => {
    const result = mongoIdSchema.safeParse('a1b2c3d4e5f6a1b2c3d4e5f6');
    expect(result.success).toBe(true);
  });

  // 2. Valid 24-char uppercase hex (case-insensitive)
  it('accepts a valid 24-char uppercase hex string', () => {
    const result = mongoIdSchema.safeParse('A1B2C3D4E5F6A1B2C3D4E5F6');
    expect(result.success).toBe(true);
  });

  // 3. String shorter than 24 chars
  it('rejects a string shorter than 24 chars', () => {
    const result = mongoIdSchema.safeParse('a1b2c3d4e5f6');
    expect(result.success).toBe(false);
  });

  // 4. String longer than 24 chars
  it('rejects a string longer than 24 chars', () => {
    const result = mongoIdSchema.safeParse('a1b2c3d4e5f6a1b2c3d4e5f6aaaa');
    expect(result.success).toBe(false);
  });

  // 5. 24-char string with non-hex characters
  it('rejects a 24-char string containing non-hex characters', () => {
    const result = mongoIdSchema.safeParse('g1b2c3d4e5f6a1b2c3d4e5f6');
    expect(result.success).toBe(false);
  });

  it('rejects a 24-char string containing spaces', () => {
    const result = mongoIdSchema.safeParse('a1b2c3d4e5f6a1b2c3d4e5 6');
    expect(result.success).toBe(false);
  });

  // 6. Empty string
  it('rejects an empty string', () => {
    const result = mongoIdSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  // 7. Valid MongoDB ObjectId format
  it('accepts a real MongoDB ObjectId string', () => {
    const result = mongoIdSchema.safeParse('507f1f77bcf86cd799439011');
    expect(result.success).toBe(true);
  });

  // 8. Error message on failure is 'Invalid ID format'
  it('returns "Invalid ID format" as the error message on failure', () => {
    const result = mongoIdSchema.safeParse('not-a-valid-id');
    expect(result.success).toBe(false);
    const issues = result.error.issues;
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].message).toBe('Invalid ID format');
  });

  // PBT: any random 24-char lowercase hex string must pass
  /**
   * Validates: mongoIdSchema accepts all valid 24-char hex strings
   */
  it('accepts all random 24-char lowercase hex strings (property-based)', () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 24, maxLength: 24 }),
        (hexId) => mongoIdSchema.safeParse(hexId).success === true
      ),
      { numRuns: 200 }
    );
  });
});
