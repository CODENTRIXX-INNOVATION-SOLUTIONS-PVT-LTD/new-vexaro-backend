'use strict';

const fc = require('fast-check');
const {
  validatePassword,
  isValidPassword,
  createPasswordSchema,
  PASSWORD_ERROR_CODES,
} = require('../../validators/password.validator');

describe('password validator', () => {
  test('accepts a strong password without exposing it in the result', () => {
    const password = 'Vexaro!2026Secure';
    const result = validatePassword(password);
    expect(result).toMatchObject({ isValid: true, strength: 'very-strong' });
    expect(JSON.stringify(result)).not.toContain(password);
  });

  test.each([
    ['short', PASSWORD_ERROR_CODES.TOO_SHORT],
    ['alllowercase!2026', PASSWORD_ERROR_CODES.MISSING_UPPERCASE],
    ['ALLUPPERCASE!2026', PASSWORD_ERROR_CODES.MISSING_LOWERCASE],
    ['NoNumbers!Here', PASSWORD_ERROR_CODES.MISSING_NUMBER],
    ['NoSymbols2026Here', PASSWORD_ERROR_CODES.MISSING_SYMBOL],
    ['Repeat!!!!AAAA2026x', PASSWORD_ERROR_CODES.REPEATED],
  ])('rejects %s', (password, code) => {
    expect(validatePassword(password)).toMatchObject({ isValid: false, error: code });
  });

  test('blocks common and contextual passwords', () => {
    expect(validatePassword('Password123!', { minLength: 8 })).toMatchObject({ isValid: false });
    expect(validatePassword('Sijal!Secure2026', { context: ['sijal@example.com'] }))
      .toMatchObject({ isValid: false, error: PASSWORD_ERROR_CODES.CONTAINS_CONTEXT });
  });

  test('integrates with Zod', () => {
    const schema = createPasswordSchema();
    expect(schema.safeParse('Vexaro!2026Secure').success).toBe(true);
    expect(schema.safeParse('weak').success).toBe(false);
  });

  test('never accepts values below the configured minimum length', () => {
    fc.assert(fc.property(fc.string({ maxLength: 11 }), (value) => !isValidPassword(value)), { numRuns: 200 });
  });
});
