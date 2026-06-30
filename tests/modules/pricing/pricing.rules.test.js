'use strict';

/**
 * Tests for src/modules/pricing/pricing.rules.js
 *
 * Covers:
 *  - findMatchingSlab: weight within a slab, weight exceeding all slabs,
 *    unsorted input array
 *
 * Property-based tests:
 *  - Property 1: always returns a non-null slab for any billing weight > 0 and
 *    any non-empty slab array
 *  - Property 2: returned slab's upToKg is always the minimum value >= billingWeight,
 *    or the maximum upToKg if no slab covers the weight
 *
 * Validates: Requirements R8
 */

const fc = require('fast-check');
const { findMatchingSlab } = require('../../../src/modules/pricing/pricing.rules');

// ─── findMatchingSlab ──────────────────────────────────────────────────────────

describe('findMatchingSlab', () => {

  // Sorted slabs used across multiple tests
  const slabs = [
    { upToKg: 0.5, baseCharge: 30 },
    { upToKg: 1.0, baseCharge: 50 },
    { upToKg: 2.0, baseCharge: 80 },
    { upToKg: 5.0, baseCharge: 120 },
    { upToKg: 10.0, baseCharge: 200 },
  ];

  describe('weight falls within a slab', () => {
    test('billingWeight = 0.3 matches first slab (upToKg 0.5)', () => {
      const result = findMatchingSlab(slabs, 0.3);
      expect(result).toBeDefined();
      expect(result.upToKg).toBe(0.5);
    });

    test('billingWeight = 0.5 matches first slab exactly (upToKg 0.5)', () => {
      const result = findMatchingSlab(slabs, 0.5);
      expect(result).toBeDefined();
      expect(result.upToKg).toBe(0.5);
    });

    test('billingWeight = 0.6 matches second slab (upToKg 1.0)', () => {
      const result = findMatchingSlab(slabs, 0.6);
      expect(result).toBeDefined();
      expect(result.upToKg).toBe(1.0);
    });

    test('billingWeight = 1.5 matches third slab (upToKg 2.0)', () => {
      const result = findMatchingSlab(slabs, 1.5);
      expect(result).toBeDefined();
      expect(result.upToKg).toBe(2.0);
    });

    test('billingWeight = 10.0 matches last slab exactly (upToKg 10.0)', () => {
      const result = findMatchingSlab(slabs, 10.0);
      expect(result).toBeDefined();
      expect(result.upToKg).toBe(10.0);
    });

    test('returns the lowest slab whose upToKg >= billingWeight', () => {
      // 3 kg should match the 5 kg slab, not the 10 kg slab
      const result = findMatchingSlab(slabs, 3);
      expect(result.upToKg).toBe(5.0);
    });
  });

  describe('weight exceeds all slabs', () => {
    test('billingWeight = 15 (> max 10.0) returns the last (highest) slab', () => {
      const result = findMatchingSlab(slabs, 15);
      expect(result).toBeDefined();
      expect(result.upToKg).toBe(10.0);
    });

    test('billingWeight = 100 returns the last (highest) slab', () => {
      const result = findMatchingSlab(slabs, 100);
      expect(result).toBeDefined();
      expect(result.upToKg).toBe(10.0);
    });

    test('single-element slab array: weight exceeding it still returns that slab', () => {
      const singleSlab = [{ upToKg: 2, baseCharge: 50 }];
      const result = findMatchingSlab(singleSlab, 999);
      expect(result).toBeDefined();
      expect(result.upToKg).toBe(2);
    });
  });

  describe('unsorted slab input array', () => {
    test('sorts internally and returns the correct slab for weight in range', () => {
      const unsorted = [
        { upToKg: 10.0, baseCharge: 200 },
        { upToKg: 0.5, baseCharge: 30 },
        { upToKg: 5.0, baseCharge: 120 },
        { upToKg: 1.0, baseCharge: 50 },
        { upToKg: 2.0, baseCharge: 80 },
      ];
      const result = findMatchingSlab(unsorted, 0.7);
      expect(result).toBeDefined();
      // After sorting, 0.7 should fall into the 1.0 kg slab (not 10.0)
      expect(result.upToKg).toBe(1.0);
    });

    test('unsorted array: weight exceeding all slabs returns highest slab', () => {
      const unsorted = [
        { upToKg: 5.0, baseCharge: 120 },
        { upToKg: 0.5, baseCharge: 30 },
        { upToKg: 10.0, baseCharge: 200 },
        { upToKg: 2.0, baseCharge: 80 },
      ];
      const result = findMatchingSlab(unsorted, 50);
      expect(result).toBeDefined();
      expect(result.upToKg).toBe(10.0);
    });

    test('does not mutate the original slab array', () => {
      const unsorted = [
        { upToKg: 5.0, baseCharge: 120 },
        { upToKg: 1.0, baseCharge: 50 },
        { upToKg: 2.0, baseCharge: 80 },
      ];
      const originalOrder = unsorted.map(s => s.upToKg);
      findMatchingSlab(unsorted, 1.5);
      expect(unsorted.map(s => s.upToKg)).toEqual(originalOrder);
    });
  });
});

// ─── Property-based tests ──────────────────────────────────────────────────────

describe('Property-based tests', () => {

  /**
   * Arbitrary that generates a non-empty array of slab objects with unique,
   * positive upToKg values.
   */
  const slabArrayArb = fc
    .uniqueArray(fc.double({ min: 0.1, max: 500, noNaN: true }), {
      minLength: 1,
      maxLength: 20,
    })
    .map(values =>
      values.map(upToKg => ({
        upToKg: parseFloat(upToKg.toFixed(2)) || 0.1,
        baseCharge: 50,
      }))
    );

  /**
   * Property 1: For any billing weight > 0 and any non-empty slab array,
   * findMatchingSlab always returns a non-null slab object.
   *
   * Validates: Requirements R8.4
   */
  test('Property 1: always returns a non-null slab for any weight > 0 and non-empty slabs', () => {
    fc.assert(
      fc.property(
        slabArrayArb,
        fc.double({ min: 0.01, max: 1000, noNaN: true }),
        (slabArr, billingWeight) => {
          const result = findMatchingSlab(slabArr, billingWeight);
          return result !== null && result !== undefined && typeof result === 'object';
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Property 2: The returned slab's upToKg is always the minimum value >= billingWeight,
   * or the maximum upToKg in the array if no slab covers the weight.
   *
   * Validates: Requirements R8.5
   */
  test('Property 2: returned slab upToKg is minimum >= billingWeight, or max upToKg when no slab covers', () => {
    fc.assert(
      fc.property(
        slabArrayArb,
        fc.double({ min: 0.01, max: 1000, noNaN: true }),
        (slabArr, billingWeight) => {
          const result = findMatchingSlab(slabArr, billingWeight);
          const sortedUpTo = slabArr.map(s => s.upToKg).sort((a, b) => a - b);
          const maxUpToKg = sortedUpTo[sortedUpTo.length - 1];
          const validCovers = sortedUpTo.filter(v => v >= billingWeight);

          if (validCovers.length === 0) {
            // No slab covers the weight — must return the highest slab
            return result.upToKg === maxUpToKg;
          }
          // Must return the slab with the minimum upToKg that is still >= billingWeight
          const expectedUpToKg = validCovers[0]; // sorted ascending, so first is minimum
          return result.upToKg === expectedUpToKg;
        }
      ),
      { numRuns: 200 }
    );
  });
});
