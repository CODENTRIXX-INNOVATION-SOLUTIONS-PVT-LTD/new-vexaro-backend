'use strict';

const { Transaction } = require('../finance.model');
const { TransactionType } = require('../../../constants');
const { debitWallet, creditWallet, createWalletTransaction } = require('../../../utils/wallet');
const financeRepository = require('../finance.repository');
const logger = require('../../../utils/logger');

/**
 * Apply credit/debit transaction on a user's wallet atomically.
 */
const applyTransaction = async (session, userId, type, amount, meta = {}) => {
  let wallet = await financeRepository.findWalletByUserId(userId, session);
  if (!wallet) throw Object.assign(new Error('Wallet not found for user'), { statusCode: 404 });
  if (!wallet.isActive) throw Object.assign(new Error('Wallet is inactive'), { statusCode: 400 });

  // Idempotency check
  if (meta.reference) {
    const existingTx = await financeRepository.findTransaction({ reference: meta.reference }, session);
    if (existingTx) {
      return { wallet, transaction: existingTx, alreadyProcessed: true };
    }
  }

  const isDebit = [
    TransactionType.DEBIT,
    TransactionType.CHARGE,
    TransactionType.SETTLEMENT,
    TransactionType.TRANSFER_DEBIT,
    TransactionType.DISPUTE_CHARGE,
    TransactionType.RTO_CHARGE
  ].includes(type);

  let balanceBefore, balanceAfter;

  if (isDebit) {
    ({ wallet, balanceBefore, balanceAfter } = await debitWallet(session, wallet, amount));
  } else {
    ({ wallet, balanceBefore, balanceAfter } = await creditWallet(session, wallet, amount));
  }

  const tx = await createWalletTransaction(session, Transaction, {
    walletId: wallet._id,
    userId,
    type,
    amount,
    balanceBefore,
    balanceAfter,
    ...meta,
  });

  logger.info('wallet_transaction', {
    walletId:      wallet._id,
    userId,
    type,
    amount,
    balanceBefore,
    balanceAfter,
    reference:     meta.reference || null,
    performedBy:   meta.performedBy || null,
    shipmentId:    meta.shipmentId || null,
  });

  const { logAuditEvent } = require('../../audit/audit.service');
  const action = isDebit ? 'WALLET_DEBITED' : 'WALLET_CREDITED';
  logAuditEvent(meta.performedBy || userId, action, { walletId: wallet._id, type, amount, reference: meta.reference || null }, meta.shipmentId || wallet._id);

  return { wallet, transaction: tx };
};

module.exports = {
  applyTransaction,
};
