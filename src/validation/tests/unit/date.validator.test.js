'use strict';

const { validateDate, validateDateRange, createDateSchema, DATE_ERROR_CODES } = require('../../validators/date.validator');

describe('date validator', () => {
  test.each(['2026-06-29', '2026-06-29T12:30:00Z', '2026-06-29T18:00:00+05:30'])(
    'accepts ISO value %s', (value) => expect(validateDate(value).isValid).toBe(true),
  );

  test.each(['2026-02-30', '29/06/2026', '2026-06-29T12:30:00', 'not-a-date'])(
    'rejects invalid or timezone-less value %s', (value) => expect(validateDate(value).isValid).toBe(false),
  );

  test('enforces range, direction and working-day rules', () => {
    const now = new Date('2026-06-29T00:00:00Z');
    expect(validateDate('2026-06-28', { allowPast: false, now })).toMatchObject({ error: DATE_ERROR_CODES.PAST_NOT_ALLOWED });
    expect(validateDate('2026-07-01', { allowFuture: false, now })).toMatchObject({ error: DATE_ERROR_CODES.FUTURE_NOT_ALLOWED });
    expect(validateDate('2026-07-04', { workingDaysOnly: true })).toMatchObject({ error: DATE_ERROR_CODES.NON_WORKING_DAY });
  });

  test('validates ordered, bounded date ranges', () => {
    expect(validateDateRange('2026-01-01', '2026-01-31', { maxRangeDays: 31 }).isValid).toBe(true);
    expect(validateDateRange('2026-02-01', '2026-01-01').isValid).toBe(false);
    expect(validateDateRange('2025-01-01', '2026-12-31', { maxRangeDays: 366 }).isValid).toBe(false);
  });

  test('normalizes through a Zod schema', () => {
    expect(createDateSchema().parse('2026-06-29')).toBe('2026-06-29T00:00:00.000Z');
  });
});
