'use strict';

const { UserRole, TransactionType } = require('../../../constants');
const { runInTransaction } = require('../../../utils/transaction');
const financeRepository = require('../finance.repository');
const userRepository = require('../../users/user.repository');
const { applyTransaction } = require('./payment.service');
const { createNotification } = require('../../notifications/notification.service');
const { logAuditEvent } = require('../../audit/audit.service');

/**
 * Reusable helper to process a wallet refund transactionally with idempotency checks.
 */
const processRefund = async (session, { userId, amount, type, reference, shipmentId = null, note = '', performedBy }) => {
  // Enforce idempotency: check if transaction with reference already exists
  const existingRefund = await financeRepository.findTransaction({ reference }, session);
  if (existingRefund) {
    return { success: true, alreadyProcessed: true, transaction: existingRefund };
  }

  const { wallet, transaction } = await applyTransaction(session, userId, TransactionType.REFUND, amount, {
    performedBy,
    shipmentId,
    note: note || `Refund processed: ${type}`,
    reference,
  });

  try {
    await createNotification(userId, {
      title:   'Wallet Refunded',
      message: `₹${amount.toFixed(2)} has been refunded to your wallet. Reason: ${note || type}.`,
      type:    'PAYMENT',
    });
  } catch (err) {
    console.error('[Refund] Failed to send notification:', err.message);
  }

  logAuditEvent(performedBy, 'REFUND_PROCESSED', { userId, amount, type, reference }, transaction._id);

  return { success: true, wallet, transaction };
};

const refundWalletService = async (dto, caller) => {
  if (caller.role !== UserRole.SUPER_ADMIN) {
    throw Object.assign(new Error('Access denied. Only Super Admin can apply refunds.'), { statusCode: 403 });
  }

  const { userId, amount, note, shipmentId } = dto;
  const targetUser = await userRepository.findOne({ _id: userId, deletedAt: null });
  if (!targetUser) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  return runInTransaction(async (session) => {
    return processRefund(session, {
      userId,
      amount,
      type: 'MANUAL',
      reference: `REFUND-MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      shipmentId,
      note: note || 'Manual wallet refund by administrator',
      performedBy: caller.userId,
    });
  });
};

module.exports = {
  processRefund,
  refundWalletService,
};
