'use strict';

/**
 * Validates if the wallet balance is sufficient for a debit
 */
const validateBalance = (wallet, amount) => {
  if (!wallet) throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
  if (!wallet.isActive) throw Object.assign(new Error('Wallet is inactive'), { statusCode: 400 });
  if (wallet.balance < amount) {
    throw Object.assign(new Error(`Insufficient wallet balance. Available: ₹${wallet.balance.toFixed(2)}`), { statusCode: 400 });
  }
};

/**
 * Debits the wallet balance atomically and validates sufficiency
 */
const debitWallet = async (session, wallet, amount) => {
  if (!wallet) throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
  if (!wallet.isActive) throw Object.assign(new Error('Wallet is inactive'), { statusCode: 400 });

  const query = {
    _id: wallet._id,
    isActive: true,
    balance: { $gte: amount },
  };

  const update = {
    $inc: { balance: -amount },
  };

  const updatedWallet = await wallet.constructor.findOneAndUpdate(query, update, {
    returnDocument: 'after',
    session,
  });

  if (!updatedWallet) {
    const current = await wallet.constructor.findById(wallet._id).session(session);
    if (!current) throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
    if (!current.isActive) throw Object.assign(new Error('Wallet is inactive'), { statusCode: 400 });
    throw Object.assign(new Error(`Insufficient wallet balance. Available: ₹${current.balance.toFixed(2)}`), { statusCode: 400 });
  }

  // Derive balanceBefore from the DB result — NOT from the stale in-memory snapshot.
  // Using the in-memory value is wrong under concurrency: two concurrent debits both
  // read the same pre-$inc balance, so both ledger records get the same balanceBefore.
  const balanceAfter  = updatedWallet.balance;
  const balanceBefore = balanceAfter + amount; // $inc: -amount  →  before = after + amount

  wallet.balance = balanceAfter;
  return { wallet, balanceBefore, balanceAfter };
};

/**
 * Credits the wallet balance atomically
 */
const creditWallet = async (session, wallet, amount) => {
  if (!wallet) throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
  if (!wallet.isActive) throw Object.assign(new Error('Wallet is inactive'), { statusCode: 400 });

  const query = {
    _id: wallet._id,
    isActive: true,
  };

  const update = {
    $inc: { balance: amount },
  };

  const updatedWallet = await wallet.constructor.findOneAndUpdate(query, update, {
    returnDocument: 'after',
    session,
  });

  if (!updatedWallet) {
    const current = await wallet.constructor.findById(wallet._id).session(session);
    if (!current) throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
    if (!current.isActive) throw Object.assign(new Error('Wallet is inactive'), { statusCode: 400 });
  }

  // Derive balanceBefore from the DB result — NOT from the stale in-memory snapshot.
  const balanceAfter  = updatedWallet.balance;
  const balanceBefore = balanceAfter - amount; // $inc: +amount  →  before = after - amount

  wallet.balance = balanceAfter;
  return { wallet, balanceBefore, balanceAfter };
};

/**
 * Creates a transaction ledger entry for the wallet balance change
 */
const createWalletTransaction = async (session, TransactionModel, { walletId, userId, type, amount, balanceBefore, balanceAfter, ...meta }) => {
  const tx = await TransactionModel.create(
    [{ walletId, userId, type, amount, balanceBefore, balanceAfter, ...meta }],
    { session }
  );
  return tx[0];
};

module.exports = {
  validateBalance,
  debitWallet,
  creditWallet,
  createWalletTransaction,
};
