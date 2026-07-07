/**
 * tests/unit/finance/applyTransaction.test.js
 *
 * Tests for the core financial operation: applyTransaction()
 *
 * Critical invariants proved here:
 *   1. A CREDIT increases wallet balance by exact amount
 *   2. A DEBIT decreases wallet balance by exact amount
 *   3. Idempotency — same reference never double-credits
 *   4. Inactive wallet is rejected
 *   5. Missing wallet is rejected
 *   6. Insufficient balance on debit is rejected
 *   7. Transaction record is created with correct balanceBefore / balanceAfter
 */

'use strict';

// ─── Mock all external dependencies ──────────────────────────────────────────
// We mock the entire finance model and wallet utils so no DB is needed.

const mockWalletSave  = jest.fn().mockResolvedValue(undefined);
const mockTxCreate    = jest.fn();
const mockTxFindOne   = jest.fn();
const mockWalletFindOne = jest.fn();

jest.mock('../../../src/modules/finance/finance.model', () => ({
  Transaction: {},
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
  CODStatus: { PENDING: 'PENDING', REMITTED: 'REMITTED' },
}));

jest.mock('../../../src/modules/finance/finance.repository', () => ({
  findWalletByUserId: (...args) => mockWalletFindOne(...args),
  findTransaction: (...args) => mockTxFindOne(...args),
  saveWallet: jest.fn().mockImplementation(async (wallet) => wallet),
}));

jest.mock('../../../src/modules/users/user.model',     () => ({ User: {} }));
jest.mock('../../../src/modules/shipments/shipment.model', () => ({ Shipment: {} }));
jest.mock('../../../src/utils/transaction',            () => ({ runInTransaction: jest.fn() }));
jest.mock('../../../src/utils/pagination',             () => ({ getPaginationParams: jest.fn() }));
jest.mock('../../../src/modules/notifications/notification.service', () => ({
  createNotification: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../../src/utils/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock debitWallet and creditWallet — they mutate wallet.balance
jest.mock('../../../src/utils/wallet', () => ({
  debitWallet: jest.fn().mockImplementation(async (_session, wallet, amount) => {
    if (wallet.balance < amount) {
      throw Object.assign(
        new Error(`Insufficient wallet balance. Available: ₹${wallet.balance.toFixed(2)}`),
        { statusCode: 400 },
      );
    }
    const balanceBefore = wallet.balance;
    wallet.balance -= amount;
    const balanceAfter = wallet.balance;
    return { wallet, balanceBefore, balanceAfter };
  }),
  creditWallet: jest.fn().mockImplementation(async (_session, wallet, amount) => {
    const balanceBefore = wallet.balance;
    wallet.balance += amount;
    const balanceAfter = wallet.balance;
    return { wallet, balanceBefore, balanceAfter };
  }),
  createWalletTransaction: jest.fn().mockImplementation(async (_session, _Model, data) => ({
    _id: 'mock-tx-id',
    ...data,
  })),
}));

// ─── Import the function under test AFTER all mocks are set up ────────────────
const { applyTransaction } = require('../../../src/modules/finance/finance.service');
const { TransactionType }  = require('../../../src/modules/finance/finance.model');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a fake wallet document with a given balance */
const makeWallet = (balance = 1000, isActive = true) => ({
  _id:      'wallet-123',
  userId:   'user-123',
  balance,
  isActive,
  save:     mockWalletSave,
});

/** Reset all mocks between tests */
beforeEach(() => {
  jest.clearAllMocks();
  // Default: no existing transaction found (no duplicate)
  mockTxFindOne.mockResolvedValue(null);
  mockTxCreate.mockResolvedValue([{ _id: 'tx-001' }]);
});

// ─── TESTS ────────────────────────────────────────────────────────────────────

describe('applyTransaction — credit operations', () => {
  test('TOPUP increases wallet balance by exact amount', async () => {
    const wallet = makeWallet(500);
    mockWalletFindOne.mockResolvedValue(wallet);

    const result = await applyTransaction(
      null,           // session
      'user-123',
      TransactionType.TOPUP,
      200,
      { reference: 'TOPUP-001', performedBy: 'admin-id' },
    );

    expect(result.wallet.balance).toBe(700);
    expect(result.alreadyProcessed).toBeUndefined();
  });

  test('COD_CREDIT increases wallet balance correctly', async () => {
    const wallet = makeWallet(0);
    mockWalletFindOne.mockResolvedValue(wallet);

    const result = await applyTransaction(
      null,
      'user-123',
      TransactionType.COD_CREDIT,
      150,
      { reference: 'COD-abc123' },
    );

    expect(result.wallet.balance).toBe(150);
  });

  test('transaction record is created with correct balanceBefore and balanceAfter', async () => {
    const { createWalletTransaction } = require('../../../src/utils/wallet');
    const wallet = makeWallet(300);
    mockWalletFindOne.mockResolvedValue(wallet);

    await applyTransaction(null, 'user-123', TransactionType.TOPUP, 100, {
      reference: 'TOPUP-002',
    });

    expect(createWalletTransaction).toHaveBeenCalledWith(
      null,
      expect.anything(),
      expect.objectContaining({
        balanceBefore: 300,
        balanceAfter:  400,
        amount:        100,
        type:          TransactionType.TOPUP,
      }),
    );
  });
});

describe('applyTransaction — debit operations', () => {
  test('CHARGE decreases wallet balance by exact amount', async () => {
    const wallet = makeWallet(1000);
    mockWalletFindOne.mockResolvedValue(wallet);

    const result = await applyTransaction(
      null,
      'user-123',
      TransactionType.CHARGE,
      250,
      { reference: 'CHARGE-AWB001-MERCH' },
    );

    expect(result.wallet.balance).toBe(750);
  });

  test('RTO_CHARGE deducts correct amount', async () => {
    const wallet = makeWallet(500);
    mockWalletFindOne.mockResolvedValue(wallet);

    await applyTransaction(null, 'user-123', TransactionType.RTO_CHARGE, 40, {
      reference: 'RTO-AWB001-MERCH',
    });

    expect(wallet.balance).toBe(460);
  });

  test('insufficient balance throws 400 error with correct message', async () => {
    const wallet = makeWallet(10); // only ₹10 available
    mockWalletFindOne.mockResolvedValue(wallet);

    await expect(
      applyTransaction(null, 'user-123', TransactionType.CHARGE, 100, {
        reference: 'CHARGE-overdrawn',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('Insufficient'),
    });
  });
});

describe('applyTransaction — idempotency', () => {
  test('duplicate reference returns existing transaction WITHOUT crediting again', async () => {
    const existingTx = { _id: 'existing-tx', type: TransactionType.TOPUP, amount: 200 };
    // Simulate: transaction with this reference already exists in DB
    mockTxFindOne.mockResolvedValue(existingTx);

    const wallet = makeWallet(700);
    mockWalletFindOne.mockResolvedValue(wallet);

    const { creditWallet } = require('../../../src/utils/wallet');
    const result = await applyTransaction(
      null,
      'user-123',
      TransactionType.TOPUP,
      200,
      { reference: 'TOPUP-ALREADY-DONE' },
    );

    // Key assertion: creditWallet must NOT have been called
    expect(creditWallet).not.toHaveBeenCalled();
    // alreadyProcessed flag must be set
    expect(result.alreadyProcessed).toBe(true);
    // The existing transaction is returned
    expect(result.transaction).toBe(existingTx);
    // Wallet balance must be unchanged
    expect(wallet.balance).toBe(700);
  });

  test('two calls with different references both execute', async () => {
    // First call: no duplicate
    mockTxFindOne.mockResolvedValue(null);

    const wallet = makeWallet(500);
    mockWalletFindOne.mockResolvedValue(wallet);

    const { creditWallet } = require('../../../src/utils/wallet');

    await applyTransaction(null, 'user-123', TransactionType.TOPUP, 100, { reference: 'REF-A' });
    await applyTransaction(null, 'user-123', TransactionType.TOPUP, 100, { reference: 'REF-B' });

    expect(creditWallet).toHaveBeenCalledTimes(2);
  });
});

describe('applyTransaction — guard rails', () => {
  test('throws 404 when wallet not found', async () => {
    mockWalletFindOne.mockResolvedValue(null);

    await expect(
      applyTransaction(null, 'user-xyz', TransactionType.TOPUP, 100, {}),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('throws 400 when wallet is inactive', async () => {
    const wallet = makeWallet(500, false); // isActive = false
    mockWalletFindOne.mockResolvedValue(wallet);

    await expect(
      applyTransaction(null, 'user-123', TransactionType.TOPUP, 100, {}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
