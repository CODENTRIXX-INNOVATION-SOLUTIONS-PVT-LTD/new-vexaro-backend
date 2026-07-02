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
    new: true,
    session,
  });

  if (!updatedWallet) {
    const current = await wallet.constructor.findById(wallet._id).session(session);
    if (!current) throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
    if (!current.isActive) throw Object.assign(new Error('Wallet is inactive'), { statusCode: 400 });
    throw Object.assign(new Error(`Insufficient wallet balance. Available: ₹${current.balance.toFixed(2)}`), { statusCode: 400 });
  }

  wallet.balance = updatedWallet.balance;
  return wallet;
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
    new: true,
    session,
  });

  if (!updatedWallet) {
    const current = await wallet.constructor.findById(wallet._id).session(session);
    if (!current) throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
    if (!current.isActive) throw Object.assign(new Error('Wallet is inactive'), { statusCode: 400 });
  }

  wallet.balance = updatedWallet.balance;
  return wallet;
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
