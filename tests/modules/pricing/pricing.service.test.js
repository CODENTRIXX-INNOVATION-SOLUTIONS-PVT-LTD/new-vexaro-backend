'use strict';

/**
 * Tests for src/modules/pricing/pricing.service.js
 *
 * Covers:
 *  - carrierCost = baseCharge + fuelCharge + codCharge (2 dp)
 *  - isCOD=false => codCharge=0
 *  - distributorId present => distributorCost = carrierCost * (1 + saMarkup/100)
 *  - distributorId absent  => merchantCost  = carrierCost * (1 + saMarkup/100)
 *  - marginConfig present  => merchantCost includes distributorMargin + flatMargin
 *  - no matching slab      => throws error with statusCode=400
 *
 * Property-based tests:
 *  - PBT 1: merchantCost >= carrierCost always holds
 *  - PBT 2: vexaroProfit = distributorCost - carrierCost (2 dp) when distributorId present
 *  - PBT 3: billingWeight = max(declaredWeight, volumetricWeight) in returned breakdown
 *
 * Validates: Requirements R9
 */

const fc = require('fast-check');
const { calculateShippingCost } = require('../../../src/modules/pricing/pricing.service');

const DEFAULT_SA_MARKUP = 25; // SystemConfig.DEFAULT_SUPER_ADMIN_MARKUP

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a minimal valid rate card with the given slabs.
 */
const makeRateCard = (overrides = {}) => ({
  weightSlabs: [
    { upToKg: 0.5, baseRate: 0, ratePerKg: 30 },
    { upToKg: 1.0, baseRate: 0, ratePerKg: 50 },
    { upToKg: 5.0, baseRate: 0, ratePerKg: 80 },
    { upToKg: 10.0, baseRate: 0, ratePerKg: 100 },
  ],
  fuelSurcharge: 10,       // 10%
  codCharge: 20,           // flat COD charge
  codPercent: 1,           // 1% of codAmount
  superAdminMarkupPercent: DEFAULT_SA_MARKUP,
  ...overrides,
});

// ─── carrierCost formula ────────────────────────────────────────────────────────

describe('calculateShippingCost – carrierCost formula', () => {

  test('carrierCost = baseCharge + fuelCharge + codCharge (non-COD)', () => {
    const rateCard = makeRateCard();
    // billingWeight = 0.5 kg, slab ratePerKg=30, baseRate=0 => baseCharge = 0 + 30*0.5 = 15
    // fuelCharge = 15 * 0.10 = 1.5
    // codCharge = 0 (isCOD=false)
    // carrierCost = 15 + 1.5 + 0 = 16.5
    const result = calculateShippingCost({
      rateCard,
      declaredWeight: 0.5,
      isCOD: false,
    });
    expect(result.baseCharge).toBeCloseTo(15, 5);
    expect(result.fuelCharge).toBeCloseTo(1.5, 5);
    expect(result.codCharge).toBe(0);
    expect(result.carrierCost).toBe(parseFloat((15 + 1.5 + 0).toFixed(2)));
  });

  test('carrierCost = baseCharge + fuelCharge + codCharge (COD)', () => {
    const rateCard = makeRateCard({ codCharge: 20, codPercent: 1, fuelSurcharge: 10 });
    // billingWeight = 1 kg, slab upToKg=1 => ratePerKg=50
    // baseCharge = 0 + 50*1 = 50
    // fuelCharge = 50 * 0.10 = 5
    // codCharge  = 20 + (500 * 1/100) = 20 + 5 = 25
    // carrierCost = 50 + 5 + 25 = 80
    const result = calculateShippingCost({
      rateCard,
      declaredWeight: 1,
      isCOD: true,
      codAmount: 500,
    });
    expect(result.baseCharge).toBeCloseTo(50, 5);
    expect(result.fuelCharge).toBeCloseTo(5, 5);
    expect(result.codCharge).toBeCloseTo(25, 5);
    expect(result.carrierCost).toBe(parseFloat((50 + 5 + 25).toFixed(2)));
  });

  test('carrierCost is rounded to 2 decimal places', () => {
    // Use values that might produce floating-point imprecision
    const rateCard = makeRateCard({ fuelSurcharge: 7, codCharge: 0, codPercent: 0 });
    const result = calculateShippingCost({
      rateCard,
      declaredWeight: 0.3,
      isCOD: false,
    });
    // carrierCost should always be expressible as a 2 dp number
    const str = result.carrierCost.toString();
    const decimals = str.includes('.') ? str.split('.')[1].length : 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });

  test('baseRate field contributes to baseCharge when present', () => {
    const rateCard = makeRateCard({
      weightSlabs: [
        { upToKg: 2.0, baseRate: 40, ratePerKg: 20 },
      ],
      fuelSurcharge: 0,
      codCharge: 0,
      codPercent: 0,
    });
    // billingWeight = 1 kg
    // baseCharge = 40 + 20*1 = 60
    // fuelCharge = 0, codCharge = 0
    // carrierCost = 60
    const result = calculateShippingCost({
      rateCard,
      declaredWeight: 1,
      isCOD: false,
    });
    expect(result.baseCharge).toBe(60);
    expect(result.carrierCost).toBe(60);
  });
});

// ─── isCOD = false => codCharge = 0 ───────────────────────────────────────────

describe('calculateShippingCost – isCOD=false produces codCharge=0', () => {

  test('codCharge is 0 when isCOD=false (default)', () => {
    const result = calculateShippingCost({
      rateCard: makeRateCard(),
      declaredWeight: 1,
    });
    expect(result.codCharge).toBe(0);
  });

  test('codCharge is 0 when isCOD explicitly set to false', () => {
    const result = calculateShippingCost({
      rateCard: makeRateCard({ codCharge: 100, codPercent: 5 }),
      declaredWeight: 1,
      isCOD: false,
      codAmount: 1000,
    });
    expect(result.codCharge).toBe(0);
  });

  test('codCharge is positive when isCOD=true', () => {
    const result = calculateShippingCost({
      rateCard: makeRateCard({ codCharge: 20, codPercent: 1 }),
      declaredWeight: 1,
      isCOD: true,
      codAmount: 500,
    });
    expect(result.codCharge).toBeGreaterThan(0);
  });
});

// ─── distributorId present ─────────────────────────────────────────────────────

describe('calculateShippingCost – with distributorId', () => {

  test('distributorCost = carrierCost * (1 + saMarkup/100)', () => {
    const rateCard = makeRateCard({ superAdminMarkupPercent: 25, fuelSurcharge: 0, codCharge: 0, codPercent: 0 });
    const result = calculateShippingCost({
      rateCard,
      distributorId: 'dist-001',
      declaredWeight: 1,
      isCOD: false,
    });
    const expectedDistributorCost = parseFloat((result.carrierCost * (1 + 25 / 100)).toFixed(2));
    expect(result.distributorCost).toBe(expectedDistributorCost);
  });

  test('distributorCost uses rateCard.superAdminMarkupPercent', () => {
    const rateCard = makeRateCard({ superAdminMarkupPercent: 10, fuelSurcharge: 0, codCharge: 0, codPercent: 0 });
    const result = calculateShippingCost({
      rateCard,
      distributorId: 'dist-001',
      declaredWeight: 1,
    });
    const expectedDistributorCost = parseFloat((result.carrierCost * (1 + 10 / 100)).toFixed(2));
    expect(result.distributorCost).toBe(expectedDistributorCost);
  });

  test('uses DEFAULT_SUPER_ADMIN_MARKUP when rateCard has no superAdminMarkupPercent', () => {
    const rateCard = makeRateCard({ fuelSurcharge: 0, codCharge: 0, codPercent: 0 });
    delete rateCard.superAdminMarkupPercent;
    const result = calculateShippingCost({
      rateCard,
      distributorId: 'dist-001',
      declaredWeight: 1,
    });
    const expectedDistributorCost = parseFloat((result.carrierCost * (1 + DEFAULT_SA_MARKUP / 100)).toFixed(2));
    expect(result.distributorCost).toBe(expectedDistributorCost);
  });

  test('without marginConfig: merchantCost equals distributorCost', () => {
    const rateCard = makeRateCard({ fuelSurcharge: 0, codCharge: 0, codPercent: 0 });
    const result = calculateShippingCost({
      rateCard,
      distributorId: 'dist-001',
      declaredWeight: 1,
    });
    expect(result.merchantCost).toBe(result.distributorCost);
  });
});

// ─── distributorId absent ──────────────────────────────────────────────────────

describe('calculateShippingCost – without distributorId', () => {

  test('merchantCost = carrierCost * (1 + saMarkup/100)', () => {
    const rateCard = makeRateCard({ superAdminMarkupPercent: 25, fuelSurcharge: 0, codCharge: 0, codPercent: 0 });
    const result = calculateShippingCost({
      rateCard,
      declaredWeight: 1,
      isCOD: false,
    });
    const expectedMerchantCost = parseFloat((result.carrierCost * (1 + 25 / 100)).toFixed(2));
    expect(result.merchantCost).toBe(expectedMerchantCost);
  });

  test('distributorCost equals carrierCost when no distributorId', () => {
    const rateCard = makeRateCard({ fuelSurcharge: 0, codCharge: 0, codPercent: 0 });
    const result = calculateShippingCost({
      rateCard,
      declaredWeight: 1,
    });
    expect(result.distributorCost).toBe(result.carrierCost);
  });

  test('vexaroProfit is merchant markup when no distributorId (direct merchant)', () => {
    const rateCard = makeRateCard({ fuelSurcharge: 0, codCharge: 0, codPercent: 0 });
    const result = calculateShippingCost({
      rateCard,
      declaredWeight: 1,
    });
    expect(result.vexaroProfit).toBe(
      parseFloat((result.merchantCost - result.carrierCost).toFixed(2))
    );
    expect(result.distributorProfit).toBe(0);
  });
});

// ─── marginConfig ──────────────────────────────────────────────────────────────

describe('calculateShippingCost – with marginConfig', () => {

  test('merchantCost includes distributorMargin (percent)', () => {
    const rateCard = makeRateCard({ superAdminMarkupPercent: 25, fuelSurcharge: 0, codCharge: 0, codPercent: 0 });
    const marginConfig = { marginPercent: 10, flatMargin: 0 };
    const result = calculateShippingCost({
      rateCard,
      distributorId: 'dist-001',
      marginConfig,
      declaredWeight: 1,
    });
    const expectedMerchantCost = parseFloat(
      (result.distributorCost * (1 + 10 / 100) + 0).toFixed(2)
    );
    expect(result.merchantCost).toBe(expectedMerchantCost);
  });

  test('merchantCost includes flatMargin', () => {
    const rateCard = makeRateCard({ superAdminMarkupPercent: 25, fuelSurcharge: 0, codCharge: 0, codPercent: 0 });
    const marginConfig = { marginPercent: 0, flatMargin: 15 };
    const result = calculateShippingCost({
      rateCard,
      distributorId: 'dist-001',
      marginConfig,
      declaredWeight: 1,
    });
    const expectedMerchantCost = parseFloat(
      (result.distributorCost * (1 + 0 / 100) + 15).toFixed(2)
    );
    expect(result.merchantCost).toBe(expectedMerchantCost);
  });

  test('merchantCost includes both marginPercent and flatMargin', () => {
    const rateCard = makeRateCard({ superAdminMarkupPercent: 20, fuelSurcharge: 0, codCharge: 0, codPercent: 0 });
    const marginConfig = { marginPercent: 5, flatMargin: 10 };
    const result = calculateShippingCost({
      rateCard,
      distributorId: 'dist-001',
      marginConfig,
      declaredWeight: 2,
    });
    const expectedMerchantCost = parseFloat(
      (result.distributorCost * (1 + 5 / 100) + 10).toFixed(2)
    );
    expect(result.merchantCost).toBe(expectedMerchantCost);
  });

  test('merchantCost >= distributorCost when marginConfig has positive values', () => {
    const rateCard = makeRateCard({ fuelSurcharge: 0, codCharge: 0, codPercent: 0 });
    const marginConfig = { marginPercent: 5, flatMargin: 5 };
    const result = calculateShippingCost({
      rateCard,
      distributorId: 'dist-001',
      marginConfig,
      declaredWeight: 1,
    });
    expect(result.merchantCost).toBeGreaterThanOrEqual(result.distributorCost);
  });
});

// ─── missing slab throws 400 ───────────────────────────────────────────────────

describe('calculateShippingCost – missing slab throws error with statusCode=400', () => {

  test('throws when weightSlabs array is empty', () => {
    const rateCard = makeRateCard({ weightSlabs: [] });
    expect(() =>
      calculateShippingCost({ rateCard, declaredWeight: 1 })
    ).toThrow();
  });

  test('thrown error has statusCode=400 for empty slabs', () => {
    const rateCard = makeRateCard({ weightSlabs: [] });
    let caughtError;
    try {
      calculateShippingCost({ rateCard, declaredWeight: 1 });
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError).toBeDefined();
    expect(caughtError.statusCode).toBe(400);
  });

  test('error message mentions "slab" or "rate card"', () => {
    const rateCard = makeRateCard({ weightSlabs: [] });
    let caughtError;
    try {
      calculateShippingCost({ rateCard, declaredWeight: 1 });
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError.message).toMatch(/slab|rate card/i);
  });
});

// ─── volumetric / billing weight in breakdown ──────────────────────────────────

describe('calculateShippingCost – billing weight breakdown', () => {

  test('billingWeight equals declaredWeight when no dimensions given', () => {
    const result = calculateShippingCost({
      rateCard: makeRateCard(),
      declaredWeight: 2,
    });
    expect(result.billingWeight).toBe(2);
  });

  test('billingWeight uses volumetric when it is larger', () => {
    // 40x40x40 cm => 40*40*40/5000 = 64000/5000 = 12.8 kg
    const result = calculateShippingCost({
      rateCard: makeRateCard(),
      declaredWeight: 1,
      length: 40,
      breadth: 40,
      height: 40,
    });
    expect(result.billingWeight).toBe(12.8);
    expect(result.billingWeight).toBeGreaterThan(1);
  });

  test('volumetricWeight is returned in breakdown', () => {
    const result = calculateShippingCost({
      rateCard: makeRateCard(),
      declaredWeight: 1,
      length: 10,
      breadth: 10,
      height: 10,
    });
    // 10*10*10/5000 = 0.2
    expect(result.volumetricWeight).toBe(0.2);
  });
});

// ─── Property-based tests ──────────────────────────────────────────────────────

describe('Property-based tests', () => {

  /**
   * Arbitrary: a minimal valid rate card with a single slab covering
   * any billing weight up to 500 kg.
   */
  const rateCardArb = fc.record({
    fuelSurcharge:          fc.double({ min: 0, max: 30, noNaN: true }),
    codCharge:              fc.double({ min: 0, max: 100, noNaN: true }),
    codPercent:             fc.double({ min: 0, max: 5, noNaN: true }),
    superAdminMarkupPercent: fc.double({ min: 0, max: 50, noNaN: true }),
  }).map(fields => ({
    weightSlabs: [{ upToKg: 500, baseRate: 0, ratePerKg: 50 }],
    ...fields,
  }));

  /**
   * Arbitrary: positive declared weight within a slab that always matches.
   */
  const declaredWeightArb = fc.double({ min: 0.1, max: 100, noNaN: true });

  /**
   * PBT 1: merchantCost >= carrierCost for any valid input.
   *
   * Validates: Requirements R9
   */
  test('PBT 1: merchantCost >= carrierCost always holds', () => {
    fc.assert(
      fc.property(
        rateCardArb,
        declaredWeightArb,
        fc.boolean(),
        fc.double({ min: 0, max: 5000, noNaN: true }),
        (rateCard, declaredWeight, isCOD, codAmount) => {
          const result = calculateShippingCost({
            rateCard,
            declaredWeight,
            isCOD,
            codAmount,
          });
          return result.merchantCost >= result.carrierCost;
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * PBT 2: vexaroProfit = distributorCost - carrierCost (rounded to 2 dp)
   * for any inputs with a distributorId.
   *
   * Validates: Requirements R9
   */
  test('PBT 2: vexaroProfit = distributorCost − carrierCost (2 dp) when distributorId present', () => {
    fc.assert(
      fc.property(
        rateCardArb,
        declaredWeightArb,
        (rateCard, declaredWeight) => {
          const result = calculateShippingCost({
            rateCard,
            distributorId: 'dist-pbt',
            declaredWeight,
            isCOD: false,
          });
          const expected = parseFloat((result.distributorCost - result.carrierCost).toFixed(2));
          return result.vexaroProfit === expected;
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * PBT 3: billingWeight = max(declaredWeight, volumetricWeight) is reflected
   * in the returned breakdown.
   *
   * Validates: Requirements R9
   */
  test('PBT 3: billingWeight = max(declaredWeight, volumetricWeight) in breakdown', () => {
    fc.assert(
      fc.property(
        rateCardArb,
        fc.double({ min: 0.1, max: 100, noNaN: true }),    // declaredWeight
        fc.double({ min: 1, max: 50, noNaN: true }),        // length cm
        fc.double({ min: 1, max: 50, noNaN: true }),        // breadth cm
        fc.double({ min: 1, max: 50, noNaN: true }),        // height cm
        (rateCard, declaredWeight, length, breadth, height) => {
          const result = calculateShippingCost({
            rateCard,
            declaredWeight,
            length,
            breadth,
            height,
            isCOD: false,
          });
          const expectedBillingWeight = Math.max(declaredWeight, result.volumetricWeight);
          return result.billingWeight === expectedBillingWeight;
        }
      ),
      { numRuns: 200 }
    );
  });
});
