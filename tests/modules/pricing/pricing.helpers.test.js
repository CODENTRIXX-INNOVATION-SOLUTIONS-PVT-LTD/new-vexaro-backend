'use strict';

/**
 * Tests for src/modules/pricing/pricing.helpers.js
 *
 * Covers:
 *  - calculateVolumetricWeight: known dimensions, zero/falsy inputs
 *  - calculateBillingWeight: max of both inputs, equal inputs, falsy inputs
 *
 * Property-based tests:
 *  - Property 1: volumetric formula invariant – result equals parseFloat(((L*B*H)/5000).toFixed(2))
 *  - Property 2: billingWeight >= declaredWeight for any non-negative inputs
 *  - Property 3: billingWeight >= volumetricWeight for any non-negative inputs
 *
 * Validates: Requirements R7
 */

const fc = require('fast-check');
const {
  calculateVolumetricWeight,
  calculateBillingWeight,
} = require('../../../src/modules/pricing/pricing.helpers');

const VOLUMETRIC_DIVISOR = 5000;

// ─── calculateVolumetricWeight ─────────────────────────────────────────────────

describe('calculateVolumetricWeight', () => {

  describe('known dimension calculations', () => {
    test('10 x 10 x 10 => 0.2 kg', () => {
      // 10*10*10 / 5000 = 1000/5000 = 0.2
      expect(calculateVolumetricWeight(10, 10, 10)).toBe(0.2);
    });

    test('20 x 30 x 40 => 4.8 kg', () => {
      // 20*30*40 = 24000 / 5000 = 4.8
      expect(calculateVolumetricWeight(20, 30, 40)).toBe(4.8);
    });

    test('100 x 50 x 50 => 50 kg', () => {
      // 100*50*50 = 250000 / 5000 = 50
      expect(calculateVolumetricWeight(100, 50, 50)).toBe(50);
    });

    test('result is rounded to 2 decimal places', () => {
      // 10 * 10 * 3 = 300 / 5000 = 0.06
      expect(calculateVolumetricWeight(10, 10, 3)).toBe(0.06);
    });

    test('non-integer dimensions produce correct rounded result', () => {
      // 12.5 * 8.4 * 6.3 = 661.5 / 5000 = 0.1323 => 0.13
      const expected = parseFloat(((12.5 * 8.4 * 6.3) / VOLUMETRIC_DIVISOR).toFixed(2));
      expect(calculateVolumetricWeight(12.5, 8.4, 6.3)).toBe(expected);
    });
  });

  describe('zero and falsy dimensions return 0', () => {
    test('length=0 returns 0', () => {
      expect(calculateVolumetricWeight(0, 10, 10)).toBe(0);
    });

    test('breadth=0 returns 0', () => {
      expect(calculateVolumetricWeight(10, 0, 10)).toBe(0);
    });

    test('height=0 returns 0', () => {
      expect(calculateVolumetricWeight(10, 10, 0)).toBe(0);
    });

    test('all dimensions zero returns 0', () => {
      expect(calculateVolumetricWeight(0, 0, 0)).toBe(0);
    });

    test('null length returns 0', () => {
      expect(calculateVolumetricWeight(null, 10, 10)).toBe(0);
    });

    test('undefined breadth returns 0', () => {
      expect(calculateVolumetricWeight(10, undefined, 10)).toBe(0);
    });

    test('null height returns 0', () => {
      expect(calculateVolumetricWeight(10, 10, null)).toBe(0);
    });

    test('no arguments returns 0', () => {
      expect(calculateVolumetricWeight()).toBe(0);
    });
  });
});

// ─── calculateBillingWeight ────────────────────────────────────────────────────

describe('calculateBillingWeight', () => {

  describe('returns max of declared and volumetric weight', () => {
    test('declaredWeight > volumetricWeight => returns declaredWeight', () => {
      expect(calculateBillingWeight(10, 5)).toBe(10);
    });

    test('volumetricWeight > declaredWeight => returns volumetricWeight', () => {
      expect(calculateBillingWeight(3, 7)).toBe(7);
    });

    test('equal weights => returns that value', () => {
      expect(calculateBillingWeight(5, 5)).toBe(5);
    });

    test('decimal weights - returns correct max', () => {
      expect(calculateBillingWeight(4.8, 4.75)).toBe(4.8);
    });
  });

  describe('falsy / missing inputs', () => {
    test('both null => 0', () => {
      expect(calculateBillingWeight(null, null)).toBe(0);
    });

    test('declaredWeight=0, volumetricWeight=5 => 5', () => {
      expect(calculateBillingWeight(0, 5)).toBe(5);
    });

    test('declaredWeight=5, volumetricWeight=0 => 5', () => {
      expect(calculateBillingWeight(5, 0)).toBe(5);
    });

    test('undefined declaredWeight, volumetricWeight=3 => 3', () => {
      expect(calculateBillingWeight(undefined, 3)).toBe(3);
    });

    test('null declaredWeight, volumetricWeight=4 => 4', () => {
      expect(calculateBillingWeight(null, 4)).toBe(4);
    });
  });
});

// ─── Property-based tests ──────────────────────────────────────────────────────

describe('Property-based tests', () => {

  /**
   * Property 1: For any positive L, B, H, calculateVolumetricWeight(L, B, H)
   * equals parseFloat(((L * B * H) / 5000).toFixed(2)).
   *
   * Validates: Requirements R7.1
   */
  test('Property 1: volumetric formula invariant for positive dimensions', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 500, noNaN: true }),
        fc.double({ min: 0.01, max: 500, noNaN: true }),
        fc.double({ min: 0.01, max: 500, noNaN: true }),
        (length, breadth, height) => {
          const result = calculateVolumetricWeight(length, breadth, height);
          const expected = parseFloat(((length * breadth * height) / VOLUMETRIC_DIVISOR).toFixed(2));
          return result === expected;
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Property 2: billingWeight >= declaredWeight for any non-negative d and v.
   *
   * Validates: Requirements R7.3
   */
  test('Property 2: billingWeight >= declaredWeight for any non-negative inputs', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.double({ min: 0, max: 10000, noNaN: true }),
        (declared, volumetric) => {
          const billing = calculateBillingWeight(declared, volumetric);
          return billing >= declared;
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Property 3: billingWeight >= volumetricWeight for any non-negative inputs.
   *
   * Validates: Requirements R7.4
   */
  test('Property 3: billingWeight >= volumetricWeight for any non-negative inputs', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.double({ min: 0, max: 10000, noNaN: true }),
        (declared, volumetric) => {
          const billing = calculateBillingWeight(declared, volumetric);
          return billing >= volumetric;
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Property 4: billingWeight = max(declared, volumetric) for non-negative inputs.
   *
   * Validates: Requirements R7.6
   */
  test('Property 4: billingWeight equals Math.max(declared, volumetric)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.double({ min: 0, max: 10000, noNaN: true }),
        (declared, volumetric) => {
          const billing = calculateBillingWeight(declared, volumetric);
          return billing === Math.max(declared, volumetric);
        }
      ),
      { numRuns: 200 }
    );
  });
});
