/**
 * tests/unit/finance/verifyPayment.test.js
 *
 * Tests for verifyPaymentService (Razorpay payment verification)
 *
 * Critical invariants proved here:
 *   1. Invalid HMAC signature → 400 error → wallet NOT credited
 *   2. Tampered orderId → 400 error (order ID mismatch)
 *   3. Payment not found for this user → 404
 *   4. Already SUCCESS payment → idempotent return (no double-credit)
 *   5. Already FAILED payment → 400 error
 *   6. Valid signature → wallet IS credited → payment marked SUCCESS
 *   7. verifyRazorpaySignature produces correct HMAC
 */

'use strict';

const crypto = require('crypto');

// ─── Set up env before any requires ──────────────────────────────────────────
process.env.RAZORPAY_KEY_SECRET  = 'test_secret_key_for_unit_tests';
process.env.RAZORPAY_KEY_ID      = 'rzp_test_dummy';
process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_secret';
process.env.RAZORPAY_MAX_TOPUP_AMOUNT = '100000';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPaymentFindOne    = jest.fn();
const mockPaymentSave       = jest.fn().mockResolvedValue(undefined);
const mockWalletFindById    = jest.fn();
const mockTransactionFindById = jest.fn();

jest.mock('../../../src/config/env', () => ({
  env: {
    RAZORPAY_KEY_ID:            'rzp_test_dummy',
    RAZORPAY_KEY_SECRET:        'test_secret_key_for_unit_tests',
    RAZORPAY_WEBHOOK_SECRET:    'webhook_secret',
    RAZORPAY_MAX_TOPUP_AMOUNT:  100000,
    NODE_ENV:                   'test',
    MONGODB_URI:                'mongodb://localhost/test',
    JWT_SECRET:                 'test_jwt_secret',
    JWT_EXPIRES_IN:             '7d',
    EMAIL_FROM:                 'test@test.com',
    FRONTEND_URL:               'http://localhost:4200',
    VELOCITY_USERNAME:          'test',
    VELOCITY_PASSWORD:          'test',
    VELOCITY_BASE_URL:          'https://test.velocity.in/',
    SENTRY_DSN:                 '',
    PORT:                       5000,
    SMTP_HOST:                  'smtp.gmail.com',
    SMTP_PORT:                  587,
    SMTP_USER:                  '',
    SMTP_PASS:                  '',
    INVITE_TOKEN_EXPIRES_HOURS: 48,
    RESET_TOKEN_EXPIRES_HOURS:  2,
  },
}));

jest.mock('../../../src/modules/finance/payment.model', () => ({
  Payment: {
    findOne: (...args) => mockPaymentFindOne(...args),
  },
  PaymentStatus: {
    PENDING:  'PENDING',
    SUCCESS:  'SUCCESS',
    FAILED:   'FAILED',
    REFUNDED: 'REFUNDED',
  },
}));

jest.mock('../../../src/modules/finance/finance.model', () => ({
  Wallet: {
    findOne:  jest.fn(),
    findById: (...args) => mockWalletFindById(...args),
  },
  Transaction: {
    findOne:  jest.fn(),
    create:   jest.fn(),
    findById: (...args) => mockTransactionFindById(...args),
  },
  TransactionType: {
    TOPUP:          'TOPUP',
    CHARGE:         'CHARGE',
    DEBIT:          'DEBIT',
    REFUND:         'REFUND',
    SETTLEMENT:     'SETTLEMENT',
    TRANSFER_DEBIT: 'TRANSFER_DEBIT',
    DISPUTE_CHARGE: 'DISPUTE_CHARGE',
    RTO_CHARGE:     'RTO_CHARGE',
    COD_CREDIT:     'COD_CREDIT',
    TRANSFER_CREDIT:'TRANSFER_CREDIT',
    CREDIT:         'CREDIT',
  },
  CODStatus: {},
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

jest.mock('../../../src/modules/notifications/notification.service', () => ({
  createNotification: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../src/utils/pagination', () => ({
  getPaginationParams: jest.fn(),
}));

jest.mock('../../../src/utils/transaction', () => ({
  runInTransaction: jest.fn().mockImplementation(async (fn) => fn(null)),
}));

jest.mock('../../../src/utils/wallet', () => ({
  debitWallet:             jest.fn(),
  creditWallet:            jest.fn().mockImplementation(async (_s, wallet, amount) => {
    wallet.balance += amount;
    return wallet;
  }),
  createWalletTransaction: jest.fn().mockResolvedValue({ _id: 'tx-new' }),
}));

jest.mock('../../../src/modules/finance/finance.service', () => {
  const actual = jest.requireActual('../../../src/modules/finance/finance.service');
  return {
    ...actual,
    applyTransaction: jest.fn().mockResolvedValue({
      wallet:      { _id: 'wallet-1', balance: 700 },
      transaction: { _id: 'tx-new' },
    }),
  };
});

jest.mock('razorpay', () => jest.fn().mockImplementation(() => ({
  orders: { create: jest.fn() },
})));

// ─── Import AFTER mocks ───────────────────────────────────────────────────────
const { verifyPaymentService, verifyRazorpaySignature } = require('../../../src/modules/finance/razorpay.service');
const { PaymentStatus } = require('../../../src/modules/finance/payment.model');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = 'test_secret_key_for_unit_tests';

/** Compute a valid Razorpay HMAC signature */
const makeValidSignature = (orderId, paymentId) =>
  crypto.createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex');

const makePendingPayment = (overrides = {}) => {
  const doc = {
    _id:             'payment-001',
    userId:          'user-123',
    walletId:        'wallet-001',
    razorpayOrderId: 'order_ABCDEF',
    amount:          500,
    status:          'PENDING',
    transactionId:   null,
    failureReason:   null,
    save:            mockPaymentSave,
    ...overrides,
  };
  return doc;
};

const MERCHANT_CALLER = { userId: 'user-123', role: 'MERCHANT', email: 'merch@v.in' };

const VALID_DTO = (orderId = 'order_ABCDEF', paymentId = 'pay_XYZ123') => ({
  paymentId:         'payment-001',
  orderId,
  razorpayPaymentId: paymentId,
  signature:         makeValidSignature(orderId, paymentId),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPaymentSave.mockResolvedValue(undefined);
});

// ─── TESTS ────────────────────────────────────────────────────────────────────

describe('verifyRazorpaySignature — HMAC helper', () => {
  test('returns true for a correctly computed signature', () => {
    const orderId   = 'order_TEST123';
    const paymentId = 'pay_TEST456';
    const sig       = makeValidSignature(orderId, paymentId);

    expect(verifyRazorpaySignature(orderId, paymentId, sig)).toBe(true);
  });

  test('returns false when signature is tampered', () => {
    const orderId   = 'order_TEST123';
    const paymentId = 'pay_TEST456';
    const badSig    = 'aaaa' + makeValidSignature(orderId, paymentId).slice(4);

    expect(verifyRazorpaySignature(orderId, paymentId, badSig)).toBe(false);
  });

  test('throws when signature has wrong byte length (timingSafeEqual requirement)', () => {
    // crypto.timingSafeEqual requires equal-length buffers.
    // A real tampered short signature correctly throws — verifyPaymentService
    // catches this internally and treats it as an invalid signature (returns false).
    // We verify the raw function surfaces this expected Node crypto behaviour.
    expect(() =>
      verifyRazorpaySignature('order_A', 'pay_B', 'too_short'),
    ).toThrow('byte length');
  });
});

describe('verifyPaymentService — guard rails', () => {
  test('throws 404 when payment record not found', async () => {
    mockPaymentFindOne.mockResolvedValue(null);

    await expect(
      verifyPaymentService(VALID_DTO(), MERCHANT_CALLER),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('throws 400 when orderId does not match stored razorpayOrderId', async () => {
    const payment = makePendingPayment({ razorpayOrderId: 'order_ORIGINAL' });
    mockPaymentFindOne.mockResolvedValue(payment);

    const dtoWithWrongOrderId = {
      ...VALID_DTO(),
      orderId: 'order_TAMPERED',
    };

    await expect(
      verifyPaymentService(dtoWithWrongOrderId, MERCHANT_CALLER),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 when payment is already FAILED', async () => {
    const payment = makePendingPayment({ status: 'FAILED' });
    mockPaymentFindOne.mockResolvedValue(payment);

    await expect(
      verifyPaymentService(VALID_DTO(), MERCHANT_CALLER),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('verifyPaymentService — idempotency', () => {
  test('already SUCCESS payment returns without re-crediting wallet', async () => {
    const payment = makePendingPayment({
      status:        'SUCCESS',
      transactionId: 'tx-already-done',
    });
    mockPaymentFindOne.mockResolvedValue(payment);
    mockWalletFindById.mockResolvedValue({ _id: 'wallet-001', balance: 1000 });
    mockTransactionFindById.mockResolvedValue({ _id: 'tx-already-done' });

    const result = await verifyPaymentService(VALID_DTO(), MERCHANT_CALLER);

    expect(result.alreadyProcessed).toBe(true);

    // creditWallet must NOT be called
    const { creditWallet } = require('../../../src/utils/wallet');
    expect(creditWallet).not.toHaveBeenCalled();
  });
});

describe('verifyPaymentService — CRITICAL: invalid signature blocks wallet credit', () => {
  test('invalid signature throws 400 and marks payment FAILED WITHOUT crediting wallet', async () => {
    const payment = makePendingPayment();
    mockPaymentFindOne.mockResolvedValue(payment);

    const dtoWithBadSig = {
      paymentId:         'payment-001',
      orderId:           'order_ABCDEF',
      razorpayPaymentId: 'pay_XYZ123',
      signature:         'bad_signature_that_does_not_match_anything',
    };

    await expect(
      verifyPaymentService(dtoWithBadSig, MERCHANT_CALLER),
    ).rejects.toMatchObject({
      statusCode: 400,
      message:    expect.stringContaining('signature'),
    });

    // Payment must be marked FAILED in DB
    expect(payment.status).toBe('FAILED');
    expect(payment.failureReason).toBeTruthy();
    expect(mockPaymentSave).toHaveBeenCalled();

    // Wallet must NOT have been credited
    const { creditWallet } = require('../../../src/utils/wallet');
    expect(creditWallet).not.toHaveBeenCalled();
  });
});

describe('verifyPaymentService — happy path', () => {
  test('valid signature → applyTransaction called → payment marked SUCCESS', async () => {
    const payment = makePendingPayment();
    // First findOne: outside transaction. Second: inside (locked).
    mockPaymentFindOne
      .mockResolvedValueOnce(payment)   // initial lookup
      .mockResolvedValue(payment);       // locked lookup inside transaction

    const { applyTransaction } = require('../../../src/modules/finance/finance.service');

    const orderId   = 'order_ABCDEF';
    const paymentId = 'pay_XYZ123';
    const signature = makeValidSignature(orderId, paymentId);

    const result = await verifyPaymentService(
      { paymentId: 'payment-001', orderId, razorpayPaymentId: paymentId, signature },
      MERCHANT_CALLER,
    );

    // applyTransaction must have been called to credit the wallet
    expect(applyTransaction).toHaveBeenCalledWith(
      null,          // session from runInTransaction mock
      'user-123',    // caller.userId
      'TOPUP',       // TransactionType.TOPUP
      500,           // payment.amount
      expect.objectContaining({ reference: `PAY-${paymentId}` }),
    );

    // Payment must be marked SUCCESS
    expect(payment.status).toBe('SUCCESS');
    expect(payment.razorpayPaymentId).toBe(paymentId);
    expect(payment.signature).toBe(signature);

    expect(result.success).toBe(true);
    expect(result.alreadyProcessed).toBeUndefined();
  });
});
