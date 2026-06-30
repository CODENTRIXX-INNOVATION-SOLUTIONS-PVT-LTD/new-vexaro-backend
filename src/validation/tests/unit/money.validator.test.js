'use strict';

const { validateMoney, formatMoney, convertToSubunits, convertFromSubunits, createMoneySchema, getCurrencyInfo } = require('../../validators/money.validator');

describe('money validator', () => {
  test.each([0, 1, 12.34, '999.99'])(
    'accepts valid INR amount %p', (amount) => expect(validateMoney(amount).isValid).toBe(true),
  );

  test.each([-1, NaN, Infinity, '12.345', 'not-money', {}, null])(
    'rejects unsafe amount %p', (amount) => expect(validateMoney(amount).isValid).toBe(false),
  );

  test('enforces configured amount boundaries', () => {
    expect(validateMoney(99, { minAmount: 100 }).isValid).toBe(false);
    expect(validateMoney(1000001, { maxAmount: 1000000 }).isValid).toBe(false);
  });

  test('converts exactly between rupees and paise', () => {
    expect(convertToSubunits(12.34, getCurrencyInfo('INR'))).toBe(1234);
    expect(convertFromSubunits(1234, 'INR')).toBe(12.34);
    expect(formatMoney(12.34, { currency: 'INR' })).toContain('12.34');
  });

  test('provides a Zod integration schema', () => {
    const schema = createMoneySchema({ minAmount: 1, maxAmount: 100 });
    expect(schema.safeParse(10.25).success).toBe(true);
    expect(schema.safeParse(10.255).success).toBe(false);
  });
});
