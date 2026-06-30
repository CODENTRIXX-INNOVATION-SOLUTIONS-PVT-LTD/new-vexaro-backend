'use strict';

// ---------------------------------------------------------------------------
// wallet.test.js
// Tests: validateBalance, debitWallet, creditWallet, createWalletTransaction
// PBTs: credit balance invariant, debit balance invariant
// Validates: Requirements R10
// ---------------------------------------------------------------------------

const fc = require('fast-check');
const { validateBalance, debitWallet, creditWallet, createWalletTransaction } = require('../../src/utils/wallet');

// ---------------------------------------------------------------------------
// Helper: build a fake wallet with jest.fn() model methods on its constructor
// ---------------------------------------------------------------------------
const makeFakeWallet = ({ balance = 100, isActive = true, id = 'wallet-id-123' } = {}) => {
  const findOneAndUpdate = jest.fn();
  const findById = jest.fn();

  // The SUT calls wallet.constructor.findOneAndUpdate / wallet.constructor.findById
  // so we set those on the constructor (i.e. the class/function the wallet "belongs to")
  function WalletConstructor() {}
  WalletConstructor.findOneAndUpdate = findOneAndUpdate;
  WalletConstructor.findById = findById;

  const wallet = Object.create(WalletConstructor.prototype);
  wallet._id = id;
  wallet.balance = balance;
  wallet.isActive = isActive;
  // Point wallet.constructor to WalletConstructor so wallet.constructor.findOneAndUpdate works
  Object.defineProperty(wallet, 'constructor', { value: WalletConstructor });

  return { wallet, findOneAndUpdate, findById };
};

// ---------------------------------------------------------------------------
// validateBalance
// ---------------------------------------------------------------------------
describe('validateBalance', () => {
  it('does NOT throw when wallet balance exactly equals the requested amount', () => {
    const { wallet } = makeFakeWallet({ balance: 50, isActive: true });
    expect(() => validateBalance(wallet, 50)).not.toThrow();
  });

  it('does NOT throw when wallet balance is greater than the requested amount', () => {
    const { wallet } = makeFakeWallet({ balance: 200, isActive: true });
    expect(() => validateBalance(wallet, 100)).not.toThrow();
  });

  it('throws statusCode=400 with "Insufficient" message when balance < amount', () => {
    const { wallet } = makeFakeWallet({ balance: 30, isActive: true });
    let err;
    try {
      validateBalance(wallet, 50);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/Insufficient/i);
  });

  it('throws statusCode=400 when wallet is inactive', () => {
    const { wallet } = makeFakeWallet({ balance: 200, isActive: false });
    let err;
    try {
      validateBalance(wallet, 50);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
  });

  it('throws statusCode=404 when wallet is null', () => {
    let err;
    try {
      validateBalance(null, 50);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// debitWallet
// ---------------------------------------------------------------------------
describe('debitWallet', () => {
  const session = {};

  it('updates wallet.balance to balance - amount when findOneAndUpdate succeeds', async () => {
    const initialBalance = 100;
    const amount = 30;
    const expectedBalance = initialBalance - amount;

    const { wallet, findOneAndUpdate } = makeFakeWallet({ balance: initialBalance, isActive: true });

    // Simulate DB returning updated wallet with decremented balance
    const updatedDoc = { _id: wallet._id, balance: expectedBalance, isActive: true };
    findOneAndUpdate.mockResolvedValue(updatedDoc);

    const result = await debitWallet(session, wallet, amount);

    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(result.balance).toBe(expectedBalance);
    expect(wallet.balance).toBe(expectedBalance);
  });

  it('throws statusCode=404 when wallet is null', async () => {
    await expect(debitWallet(session, null, 50)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws statusCode=400 when wallet is inactive (pre-check)', async () => {
    const { wallet } = makeFakeWallet({ balance: 200, isActive: false });
    await expect(debitWallet(session, wallet, 50)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('race condition: findOneAndUpdate returns null, re-fetches and throws statusCode=400 (Insufficient)', async () => {
    const { wallet, findOneAndUpdate, findById } = makeFakeWallet({ balance: 100, isActive: true });

    // Simulate race: findOneAndUpdate returns null (another process took the balance)
    findOneAndUpdate.mockResolvedValue(null);

    // Re-fetched wallet has insufficient balance
    const refetchedWallet = {
      _id: wallet._id,
      balance: 10,
      isActive: true,
      toFixed: undefined,
    };
    // findById returns a chainable .session() mock
    const sessionChain = { session: jest.fn().mockResolvedValue(refetchedWallet) };
    findById.mockReturnValue(sessionChain);

    let err;
    try {
      await debitWallet(session, wallet, 100);
    } catch (e) {
      err = e;
    }

    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(findById).toHaveBeenCalledWith(wallet._id);
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/Insufficient/i);
  });

  it('race condition: findOneAndUpdate returns null, re-fetch returns null → throws 404', async () => {
    const { wallet, findOneAndUpdate, findById } = makeFakeWallet({ balance: 100, isActive: true });

    findOneAndUpdate.mockResolvedValue(null);
    const sessionChain = { session: jest.fn().mockResolvedValue(null) };
    findById.mockReturnValue(sessionChain);

    await expect(debitWallet(session, wallet, 50)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('race condition: findOneAndUpdate returns null, re-fetch shows inactive → throws 400', async () => {
    const { wallet, findOneAndUpdate, findById } = makeFakeWallet({ balance: 200, isActive: true });

    findOneAndUpdate.mockResolvedValue(null);
    const refetchedWallet = { _id: wallet._id, balance: 200, isActive: false };
    const sessionChain = { session: jest.fn().mockResolvedValue(refetchedWallet) };
    findById.mockReturnValue(sessionChain);

    await expect(debitWallet(session, wallet, 50)).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ---------------------------------------------------------------------------
// creditWallet
// ---------------------------------------------------------------------------
describe('creditWallet', () => {
  const session = {};

  it('updates wallet.balance to balance + amount when findOneAndUpdate succeeds', async () => {
    const initialBalance = 100;
    const amount = 50;
    const expectedBalance = initialBalance + amount;

    const { wallet, findOneAndUpdate } = makeFakeWallet({ balance: initialBalance, isActive: true });

    const updatedDoc = { _id: wallet._id, balance: expectedBalance, isActive: true };
    findOneAndUpdate.mockResolvedValue(updatedDoc);

    const result = await creditWallet(session, wallet, amount);

    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(result.balance).toBe(expectedBalance);
    expect(wallet.balance).toBe(expectedBalance);
  });

  it('throws statusCode=404 when wallet is null', async () => {
    await expect(creditWallet(session, null, 50)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws statusCode=400 when wallet is inactive', async () => {
    const { wallet } = makeFakeWallet({ balance: 100, isActive: false });
    await expect(creditWallet(session, wallet, 50)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('race: findOneAndUpdate returns null, re-fetch null → throws 404', async () => {
    const { wallet, findOneAndUpdate, findById } = makeFakeWallet({ balance: 100, isActive: true });

    findOneAndUpdate.mockResolvedValue(null);
    const sessionChain = { session: jest.fn().mockResolvedValue(null) };
    findById.mockReturnValue(sessionChain);

    await expect(creditWallet(session, wallet, 50)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('race: findOneAndUpdate returns null, re-fetch shows inactive → throws 400', async () => {
    const { wallet, findOneAndUpdate, findById } = makeFakeWallet({ balance: 100, isActive: true });

    findOneAndUpdate.mockResolvedValue(null);
    const refetchedWallet = { _id: wallet._id, balance: 100, isActive: false };
    const sessionChain = { session: jest.fn().mockResolvedValue(refetchedWallet) };
    findById.mockReturnValue(sessionChain);

    await expect(creditWallet(session, wallet, 50)).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ---------------------------------------------------------------------------
// createWalletTransaction
// ---------------------------------------------------------------------------
describe('createWalletTransaction', () => {
  it('calls TransactionModel.create with correct fields', async () => {
    const session = {};
    const createdDoc = { _id: 'tx-id-001' };

    const TransactionModel = {
      create: jest.fn().mockResolvedValue([createdDoc]),
    };

    const params = {
      walletId: 'wallet-abc',
      userId: 'user-xyz',
      type: 'DEBIT',
      amount: 75,
      balanceBefore: 200,
      balanceAfter: 125,
      reference: 'order-123',
    };

    const result = await createWalletTransaction(session, TransactionModel, params);

    expect(TransactionModel.create).toHaveBeenCalledTimes(1);
    const [docs, options] = TransactionModel.create.mock.calls[0];
    const createdWith = docs[0];

    expect(createdWith.walletId).toBe(params.walletId);
    expect(createdWith.userId).toBe(params.userId);
    expect(createdWith.type).toBe(params.type);
    expect(createdWith.amount).toBe(params.amount);
    expect(createdWith.balanceBefore).toBe(params.balanceBefore);
    expect(createdWith.balanceAfter).toBe(params.balanceAfter);
    // Extra meta fields should be spread through
    expect(createdWith.reference).toBe(params.reference);
    expect(options).toEqual({ session });
    expect(result).toBe(createdDoc);
  });

  it('returns the first element of the array returned by TransactionModel.create', async () => {
    const TransactionModel = {
      create: jest.fn().mockResolvedValue([{ _id: 'tx-1' }, { _id: 'tx-2' }]),
    };

    const result = await createWalletTransaction({}, TransactionModel, {
      walletId: 'w', userId: 'u', type: 'CREDIT', amount: 10, balanceBefore: 0, balanceAfter: 10,
    });

    expect(result._id).toBe('tx-1');
  });
});

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

/**
 * Validates: Requirements R10
 *
 * PBT: For any positive credit amount, wallet.balance after credit equals
 * original balance + amount.
 */
describe('PBT: creditWallet balance invariant', () => {
  it('balance after credit always equals original + amount for any positive credit amount', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10_000 }),    // initial balance
        fc.integer({ min: 1, max: 10_000 }),    // credit amount (positive)
        async (initialBalance, amount) => {
          const { wallet, findOneAndUpdate } = makeFakeWallet({ balance: initialBalance, isActive: true });

          const expectedBalance = initialBalance + amount;
          findOneAndUpdate.mockResolvedValue({ _id: wallet._id, balance: expectedBalance, isActive: true });

          const result = await creditWallet({}, wallet, amount);
          return result.balance === expectedBalance && result.balance === initialBalance + amount;
        }
      ),
      { numRuns: 200 }
    );
  });
});

/**
 * Validates: Requirements R10
 *
 * PBT: For any debit amount ≤ balance, wallet.balance after debit equals
 * original balance - amount.
 */
describe('PBT: debitWallet balance invariant', () => {
  it('balance after debit always equals original - amount when amount <= balance', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10_000 }),   // initial balance
        fc.integer({ min: 1, max: 10_000 }),   // debit amount (will be clamped to <= balance)
        async (initialBalance, rawAmount) => {
          // Clamp amount to be <= initialBalance so the debit is valid
          const amount = Math.min(rawAmount, initialBalance);
          const { wallet, findOneAndUpdate } = makeFakeWallet({ balance: initialBalance, isActive: true });

          const expectedBalance = initialBalance - amount;
          findOneAndUpdate.mockResolvedValue({ _id: wallet._id, balance: expectedBalance, isActive: true });

          const result = await debitWallet({}, wallet, amount);
          return result.balance === expectedBalance && result.balance === initialBalance - amount;
        }
      ),
      { numRuns: 200 }
    );
  });
});
