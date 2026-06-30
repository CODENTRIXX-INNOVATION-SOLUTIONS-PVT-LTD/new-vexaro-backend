'use strict';

/**
 * Property 4: DTO Schema Round-Trip Validity
 * For each exported DTO schema, any object generated to satisfy the schema must
 * have schema.safeParse(obj).success === true
 *
 * Validates: Requirements 3.2, 3.5
 */

const fc = require('fast-check');

// ─── Auth DTOs ─────────────────────────────────────────────────────────────────
const {
  loginSchema,
  setPasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changeInitialCredentialsSchema,
} = require('../../src/dto/auth/auth.dto');

// ─── Shipment DTOs ─────────────────────────────────────────────────────────────
const {
  createShipmentSchema,
  updateShipmentSchema,
  updateStatusSchema,
  listShipmentsQuerySchema,
  awbSearchSchema,
  serviceabilitySchema,
  velocityRatesSchema,
  createReverseShipmentSchema,
} = require('../../src/dto/shipments/shipment.dto');

// ─── Finance DTOs ──────────────────────────────────────────────────────────────
const {
  topupSchema,
  remitCODSchema,
  createSettlementSchema,
  processSettlementSchema,
  listQuerySchema: financeListQuerySchema,
  transferToMerchantSchema,
  refundSchema,
} = require('../../src/dto/finance/finance.dto');

// ─── Dispute DTOs ──────────────────────────────────────────────────────────────
const {
  createDisputeSchema,
  updateDisputeSchema,
  listQuerySchema: disputeListQuerySchema,
  raiseWeightDisputeSchema,
  resolveWeightDisputeSchema,
  submitDisputeProofSchema,
  listWeightDisputesQuerySchema,
} = require('../../src/dto/disputes/dispute.dto');

// ─── Notification DTOs ─────────────────────────────────────────────────────────
const {
  listNotificationsQuerySchema,
  markReadSchema,
} = require('../../src/dto/notifications/notification.dto');

// ─── Rate DTOs ─────────────────────────────────────────────────────────────────
const {
  createRateCardDto,
  updateRateCardDto,
  createMarginConfigDto,
  calculateRateDto,
} = require('../../src/dto/rates/rate.dto');

// ─── Settings DTOs ─────────────────────────────────────────────────────────────
const {
  updateProfileDto,
  changePasswordDto,
  createApiKeyDto,
  updateNotificationPrefsDto,
} = require('../../src/dto/settings/settings.dto');

// ─── Support DTOs ─────────────────────────────────────────────────────────────
const {
  createTicketDto,
  updateTicketDto,
  addReplyDto,
  listTicketsQueryDto,
} = require('../../src/dto/support/support.dto');

// ─── Report DTOs ──────────────────────────────────────────────────────────────
const {
  reportQueryDto,
  exportQueryDto,
} = require('../../src/dto/reports/report.dto');

// ─── Constants ────────────────────────────────────────────────────────────────
const {
  ShipmentStatus,
  ShipmentServiceType,
  DisputeStatus,
  DisputeCategory,
  TicketStatus,
  TicketPriority,
  TicketCategory,
} = require('../../src/constants');

// ─── Shared Arbitraries ───────────────────────────────────────────────────────

/** 24-char lowercase hex string — valid mongoId */
const mongoIdArb = fc
  .array(fc.integer({ min: 0, max: 15 }), { minLength: 24, maxLength: 24 })
  .map((arr) => arr.map((n) => n.toString(16)).join(''));

/** Password satisfying: min 8, uppercase, lowercase, digit */
const passwordArb = fc
  .string({ minLength: 5, maxLength: 20 })
  .map((s) => `Aa1${s}`);

/**
 * Valid email address — uses a constrained pattern because Zod's z.email()
 * follows a stricter RFC than fc.emailAddress() which can emit local-parts
 * starting with special characters (e.g. "!a.a@a.aa") that Zod rejects.
 */
const emailArb = fc
  .tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{2,8}$/),
    fc.stringMatching(/^[a-z][a-z0-9]{1,8}$/),
    fc.stringMatching(/^[a-z]{2,4}$/)
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/** 6-digit numeric pincode as string */
const pincodeArb = fc
  .integer({ min: 100000, max: 999999 })
  .map((n) => String(n));

/** Positive number */
const positiveNumberArb = fc.double({ min: 0.01, max: 10000, noNaN: true, noDefaultInfinity: true });

/** Non-negative number */
const nonNegNumberArb = fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true });

/** Page/limit as numeric string (1–100) */
const pageArb = fc.integer({ min: 1, max: 100 }).map(String);
const limitArb = fc.integer({ min: 1, max: 100 }).map(String);

/** ISO datetime string */
const datetimeArb = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .map((d) => d.toISOString());

/** URL string */
const urlArb = fc.webUrl({ validSchemes: ['https'] });

/** Non-empty trimmed string */
const nonEmptyStrArb = fc.string({ minLength: 1, maxLength: 50 }).map((s) => s.trim() || 'x');

/** Pick a random value from an array */
function oneOf(arr) {
  return fc.integer({ min: 0, max: arr.length - 1 }).map((i) => arr[i]);
}

const shipmentStatusArb    = oneOf(Object.values(ShipmentStatus));
const serviceTypeArb       = oneOf(Object.values(ShipmentServiceType));
const disputeStatusArb     = oneOf(Object.values(DisputeStatus));
const disputeCategoryArb   = oneOf(Object.values(DisputeCategory));
const ticketStatusArb      = oneOf(Object.values(TicketStatus));
const ticketPriorityArb    = oneOf(Object.values(TicketPriority));
const ticketCategoryArb    = oneOf(Object.values(TicketCategory));

/** Address object matching addressSchema in shipment.dto */
const addressArb = fc.record({
  name:        nonEmptyStrArb,
  phone:       fc.stringMatching(/^[0-9]{7,12}$/),
  addressLine: nonEmptyStrArb,
  city:        nonEmptyStrArb,
  state:       nonEmptyStrArb,
  pincode:     pincodeArb,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 4: DTO Schema Round-Trip Validity', () => {

  // ── Auth ────────────────────────────────────────────────────────────────────
  describe('auth DTOs', () => {

    test('loginSchema accepts valid login data', () => {
      fc.assert(
        fc.property(
          fc.record({ email: emailArb, password: fc.string({ minLength: 1, maxLength: 50 }) }),
          (input) => loginSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('setPasswordSchema accepts valid token + password', () => {
      fc.assert(
        fc.property(
          fc.record({ token: nonEmptyStrArb, password: passwordArb }),
          (input) => setPasswordSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('forgotPasswordSchema accepts valid email', () => {
      fc.assert(
        fc.property(
          fc.record({ email: emailArb }),
          (input) => forgotPasswordSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('resetPasswordSchema accepts valid token + password', () => {
      fc.assert(
        fc.property(
          fc.record({ token: nonEmptyStrArb, password: passwordArb }),
          (input) => resetPasswordSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('changeInitialCredentialsSchema accepts valid email + password', () => {
      fc.assert(
        fc.property(
          fc.record({ newEmail: emailArb, newPassword: passwordArb }),
          (input) => changeInitialCredentialsSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });
  });

  // ── Shipments ───────────────────────────────────────────────────────────────
  describe('shipment DTOs', () => {

    test('createShipmentSchema accepts valid shipment data', () => {
      fc.assert(
        fc.property(
          fc.record({
            destination: addressArb,
            weight:      positiveNumberArb,
          }),
          (input) => createShipmentSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('updateShipmentSchema accepts data with at least weight', () => {
      fc.assert(
        fc.property(
          fc.record({ weight: positiveNumberArb }),
          (input) => updateShipmentSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('updateStatusSchema accepts valid status', () => {
      fc.assert(
        fc.property(
          fc.record({ status: shipmentStatusArb }),
          (input) => updateStatusSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('listShipmentsQuerySchema accepts valid query strings', () => {
      fc.assert(
        fc.property(
          fc.record({ page: pageArb, limit: limitArb }, { requiredKeys: [] }),
          (input) => listShipmentsQuerySchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('awbSearchSchema accepts non-empty AWB string', () => {
      fc.assert(
        fc.property(
          fc.record({ awb: nonEmptyStrArb }),
          (input) => awbSearchSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('serviceabilitySchema accepts valid 6-digit pincodes', () => {
      fc.assert(
        fc.property(
          fc.record({ fromPincode: pincodeArb, toPincode: pincodeArb }),
          (input) => serviceabilitySchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('velocityRatesSchema accepts valid return journey data', () => {
      const baseArb = fc.record({
        journeyType:         fc.constant('return'),
        originPincode:       pincodeArb,
        destinationPincode:  pincodeArb,
        deadWeightGrams:     positiveNumberArb,
        length:              positiveNumberArb,
        width:               positiveNumberArb,
        height:              positiveNumberArb,
      });
      fc.assert(
        fc.property(baseArb, (input) => velocityRatesSchema.safeParse(input).success === true),
        { numRuns: 100 }
      );
    });

    test('velocityRatesSchema accepts valid forward+prepaid journey', () => {
      const arb = fc.record({
        journeyType:         fc.constant('forward'),
        originPincode:       pincodeArb,
        destinationPincode:  pincodeArb,
        deadWeightGrams:     positiveNumberArb,
        length:              positiveNumberArb,
        width:               positiveNumberArb,
        height:              positiveNumberArb,
        paymentMethod:       fc.constant('prepaid'),
      });
      fc.assert(
        fc.property(arb, (input) => velocityRatesSchema.safeParse(input).success === true),
        { numRuns: 100 }
      );
    });

    test('velocityRatesSchema accepts valid forward+cod journey with shipmentValue', () => {
      const arb = fc.record({
        journeyType:         fc.constant('forward'),
        originPincode:       pincodeArb,
        destinationPincode:  pincodeArb,
        deadWeightGrams:     positiveNumberArb,
        length:              positiveNumberArb,
        width:               positiveNumberArb,
        height:              positiveNumberArb,
        paymentMethod:       fc.constant('cod'),
        shipmentValue:       positiveNumberArb,
      });
      fc.assert(
        fc.property(arb, (input) => velocityRatesSchema.safeParse(input).success === true),
        { numRuns: 100 }
      );
    });

    test('createReverseShipmentSchema accepts valid reverse shipment data', () => {
      const orderItemArb = fc.record({
        name:          nonEmptyStrArb,
        sku:           nonEmptyStrArb,
        units:         fc.integer({ min: 1, max: 100 }),
        selling_price: nonNegNumberArb,
      });
      const arb = fc.record({
        pickupFirstName:   nonEmptyStrArb,
        pickupAddress:     nonEmptyStrArb,
        pickupCity:        nonEmptyStrArb,
        pickupState:       nonEmptyStrArb,
        pickupPincode:     pincodeArb,
        pickupPhone:       fc.stringMatching(/^[0-9]{7,12}$/),
        shippingFirstName: nonEmptyStrArb,
        shippingAddress:   nonEmptyStrArb,
        shippingCity:      nonEmptyStrArb,
        shippingState:     nonEmptyStrArb,
        shippingPincode:   pincodeArb,
        shippingPhone:     fc.stringMatching(/^[0-9]{7,12}$/),
        orderItems:        fc.array(orderItemArb, { minLength: 1, maxLength: 5 }),
        subTotal:          nonNegNumberArb,
        length:            positiveNumberArb,
        breadth:           positiveNumberArb,
        height:            positiveNumberArb,
        weight:            positiveNumberArb,
      });
      fc.assert(
        fc.property(arb, (input) => createReverseShipmentSchema.safeParse(input).success === true),
        { numRuns: 100 }
      );
    });
  });

  // ── Finance ─────────────────────────────────────────────────────────────────
  describe('finance DTOs', () => {

    test('topupSchema accepts valid userId + positive amount', () => {
      fc.assert(
        fc.property(
          fc.record({ userId: mongoIdArb, amount: positiveNumberArb }),
          (input) => topupSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('remitCODSchema accepts empty object (note optional)', () => {
      fc.assert(
        fc.property(fc.constant({}), (input) => remitCODSchema.safeParse(input).success === true),
        { numRuns: 100 }
      );
    });

    test('createSettlementSchema accepts valid toUserId + amount', () => {
      fc.assert(
        fc.property(
          fc.record({ toUserId: mongoIdArb, amount: positiveNumberArb }),
          (input) => createSettlementSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('processSettlementSchema accepts boolean success', () => {
      fc.assert(
        fc.property(
          fc.record({ success: fc.boolean() }),
          (input) => processSettlementSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('finance listQuerySchema accepts valid page/limit strings', () => {
      fc.assert(
        fc.property(
          fc.record({ page: pageArb, limit: limitArb }, { requiredKeys: [] }),
          (input) => financeListQuerySchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('transferToMerchantSchema accepts valid merchantId + amount', () => {
      fc.assert(
        fc.property(
          fc.record({ merchantId: mongoIdArb, amount: positiveNumberArb }),
          (input) => transferToMerchantSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('refundSchema accepts valid userId + amount', () => {
      fc.assert(
        fc.property(
          fc.record({ userId: mongoIdArb, amount: positiveNumberArb }),
          (input) => refundSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });
  });

  // ── Disputes ─────────────────────────────────────────────────────────────────
  describe('dispute DTOs', () => {

    test('createDisputeSchema accepts valid shipmentId + category + description', () => {
      fc.assert(
        fc.property(
          fc.record({
            shipmentId:  mongoIdArb,
            category:    disputeCategoryArb,
            description: fc.string({ minLength: 10, maxLength: 200 }),
          }),
          (input) => createDisputeSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('updateDisputeSchema accepts object with at least status', () => {
      fc.assert(
        fc.property(
          fc.record({ status: disputeStatusArb }),
          (input) => updateDisputeSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('dispute listQuerySchema accepts valid page/limit strings', () => {
      fc.assert(
        fc.property(
          fc.record({ page: pageArb, limit: limitArb }, { requiredKeys: [] }),
          (input) => disputeListQuerySchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('raiseWeightDisputeSchema accepts valid shipmentId + weights', () => {
      fc.assert(
        fc.property(
          fc.record({
            shipmentId:   mongoIdArb,
            actualWeight: positiveNumberArb,
            extraCharge:  nonNegNumberArb,
          }),
          (input) => raiseWeightDisputeSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('resolveWeightDisputeSchema accepts RESOLVED or CLOSED', () => {
      fc.assert(
        fc.property(
          fc.record({ status: oneOf([DisputeStatus.RESOLVED, DisputeStatus.CLOSED]) }),
          (input) => resolveWeightDisputeSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('submitDisputeProofSchema accepts non-empty URL array', () => {
      fc.assert(
        fc.property(
          fc.record({ proofImages: fc.array(urlArb, { minLength: 1, maxLength: 5 }) }),
          (input) => submitDisputeProofSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('listWeightDisputesQuerySchema accepts valid page/limit strings', () => {
      fc.assert(
        fc.property(
          fc.record({ page: pageArb, limit: limitArb }, { requiredKeys: [] }),
          (input) => listWeightDisputesQuerySchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });
  });

  // ── Notifications ─────────────────────────────────────────────────────────────
  describe('notification DTOs', () => {

    test('listNotificationsQuerySchema accepts valid page/limit strings', () => {
      fc.assert(
        fc.property(
          fc.record({ page: pageArb, limit: limitArb }, { requiredKeys: [] }),
          (input) => listNotificationsQuerySchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('markReadSchema accepts empty object (ids optional)', () => {
      fc.assert(
        fc.property(fc.constant({}), (input) => markReadSchema.safeParse(input).success === true),
        { numRuns: 100 }
      );
    });

    test('markReadSchema accepts array of valid mongoIds', () => {
      fc.assert(
        fc.property(
          fc.record({ ids: fc.array(mongoIdArb, { minLength: 0, maxLength: 5 }) }),
          (input) => markReadSchema.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });
  });

  // ── Rates ─────────────────────────────────────────────────────────────────────
  describe('rate DTOs', () => {

    const weightSlabArb = fc.record({
      upToKg:    positiveNumberArb,
      ratePerKg: nonNegNumberArb,
    });

    test('createRateCardDto accepts valid rate card data', () => {
      fc.assert(
        fc.property(
          fc.record({
            name:        nonEmptyStrArb,
            serviceType: serviceTypeArb,
            weightSlabs: fc.array(weightSlabArb, { minLength: 1, maxLength: 5 }),
          }),
          (input) => createRateCardDto.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('updateRateCardDto accepts partial rate card data', () => {
      fc.assert(
        fc.property(
          fc.record({ name: nonEmptyStrArb }, { requiredKeys: [] }),
          (input) => updateRateCardDto.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('createMarginConfigDto accepts valid rateCardId + marginPercent', () => {
      fc.assert(
        fc.property(
          fc.record({
            rateCardId:    mongoIdArb,
            marginPercent: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
          }),
          (input) => createMarginConfigDto.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('calculateRateDto accepts valid weight + serviceType', () => {
      fc.assert(
        fc.property(
          fc.record({
            weight:      positiveNumberArb,
            serviceType: serviceTypeArb,
          }),
          (input) => calculateRateDto.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });
  });

  // ── Settings ──────────────────────────────────────────────────────────────────
  describe('settings DTOs', () => {

    test('updateProfileDto accepts object with at least firstName', () => {
      fc.assert(
        fc.property(
          fc.record({ firstName: nonEmptyStrArb }),
          (input) => updateProfileDto.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('changePasswordDto accepts currentPassword + valid newPassword', () => {
      fc.assert(
        fc.property(
          fc.record({ currentPassword: nonEmptyStrArb, newPassword: passwordArb }),
          (input) => changePasswordDto.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('createApiKeyDto accepts valid name + permissions', () => {
      const permArb = oneOf(['READ', 'WRITE', 'WEBHOOK']);
      fc.assert(
        fc.property(
          fc.record({
            name:        nonEmptyStrArb,
            permissions: fc.array(permArb, { minLength: 1, maxLength: 3 }),
          }),
          (input) => createApiKeyDto.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('updateNotificationPrefsDto accepts object with at least one boolean pref', () => {
      fc.assert(
        fc.property(
          fc.record({ SHIPMENT: fc.boolean() }),
          (input) => updateNotificationPrefsDto.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });
  });

  // ── Support ───────────────────────────────────────────────────────────────────
  describe('support DTOs', () => {

    test('createTicketDto accepts valid subject + description + category', () => {
      fc.assert(
        fc.property(
          fc.record({
            subject:     fc.string({ minLength: 5, maxLength: 100 }),
            description: fc.string({ minLength: 20, maxLength: 500 }),
            category:    ticketCategoryArb,
          }),
          (input) => createTicketDto.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('updateTicketDto accepts object with at least status', () => {
      fc.assert(
        fc.property(
          fc.record({ status: ticketStatusArb }),
          (input) => updateTicketDto.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('addReplyDto accepts valid message', () => {
      fc.assert(
        fc.property(
          fc.record({ message: fc.string({ minLength: 1, maxLength: 500 }) }),
          (input) => addReplyDto.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('listTicketsQueryDto accepts valid page/limit strings', () => {
      fc.assert(
        fc.property(
          fc.record({ page: pageArb, limit: limitArb }, { requiredKeys: [] }),
          (input) => listTicketsQueryDto.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });
  });

  // ── Reports ───────────────────────────────────────────────────────────────────
  describe('report DTOs', () => {

    test('reportQueryDto accepts empty object (all fields optional)', () => {
      fc.assert(
        fc.property(fc.constant({}), (input) => reportQueryDto.safeParse(input).success === true),
        { numRuns: 100 }
      );
    });

    test('reportQueryDto accepts optional mongoId fields', () => {
      fc.assert(
        fc.property(
          fc.record({ merchantId: mongoIdArb }, { requiredKeys: [] }),
          (input) => reportQueryDto.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });

    test('exportQueryDto accepts empty object (all fields optional)', () => {
      fc.assert(
        fc.property(fc.constant({}), (input) => exportQueryDto.safeParse(input).success === true),
        { numRuns: 100 }
      );
    });

    test('exportQueryDto accepts optional mongoId fields', () => {
      fc.assert(
        fc.property(
          fc.record({ warehouseId: mongoIdArb }, { requiredKeys: [] }),
          (input) => exportQueryDto.safeParse(input).success === true
        ),
        { numRuns: 100 }
      );
    });
  });

});
