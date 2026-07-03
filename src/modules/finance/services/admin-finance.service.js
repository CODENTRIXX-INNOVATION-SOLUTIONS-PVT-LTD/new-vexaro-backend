'use strict';

const { UserRole, TransactionType } = require('../../../constants');
const { getPaginationParams } = require('../../../utils/pagination');
const { runInTransaction } = require('../../../utils/transaction');
const financeRepository = require('../finance.repository');
const userRepository = require('../../users/user.repository');
const { applyTransaction } = require('./payment.service');
const { createNotification } = require('../../notifications/notification.service');

/**
 * Get admin dashboard statistics
 */
const getAdminStatsService = async (caller) => {
  if (caller.role !== UserRole.SUPER_ADMIN) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const { Payment } = require('../payment.model');

  const [wallets, successPayments, refundedPayments] = await Promise.all([
    financeRepository.findAllWallets(),
    Payment.countDocuments({ status: 'SUCCESS' }).lean(),
    Payment.countDocuments({ status: 'REFUNDED' }).lean(),
  ]);

  const totalWalletValue = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);

  return {
    totalWalletValue,
    totalCommission: 0, // Commission calculated from shipment margins — implement separately
    successTransactions: successPayments,
    pendingRefunds: refundedPayments,
  };
};

/**
 * Recharge distributor wallet (manual admin action)
 */
const rechargeDistributorWalletService = async (dto, caller) => {
  const { distributorId, amount, paymentMethod, referenceId } = dto;

  if (caller.role !== UserRole.SUPER_ADMIN) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const distributor = await userRepository.findOne({ _id: distributorId, deletedAt: null });
  if (!distributor) {
    throw Object.assign(new Error('Distributor not found'), { statusCode: 404 });
  }
  if (distributor.role !== UserRole.DISTRIBUTOR) {
    throw Object.assign(new Error('Target user is not a distributor'), { statusCode: 400 });
  }

  return runInTransaction(async (session) => {
    const reference = `ADMIN-RECHARGE-${Date.now()}`;
    const { wallet, transaction } = await applyTransaction(session, distributorId, TransactionType.TOPUP, amount, {
      performedBy: caller.userId,
      note: `Manual recharge by admin via ${paymentMethod}`,
      reference,
      paymentMethod,
      referenceId,
    });

    // Update wallet with last recharge info
    wallet.lastRechargeAmount = amount;
    wallet.lastRechargeDate = new Date();
    await wallet.save({ session });

    try {
      await createNotification(distributorId, {
        title: 'Wallet Recharged',
        message: `INR ${amount} has been added to your wallet by admin.`,
        type: 'PAYMENT',
        meta: { reference, paymentMethod },
      });
    } catch (err) {
      // Notification failure should not block the recharge
    }

    return { wallet, transaction };
  });
};

/**
 * List commission earnings (scoped by role)
 */
const listCommissionService = async (query, caller) => {
  let filter = {};
  
  if (caller.role === UserRole.DISTRIBUTOR) {
    filter = { userId: caller.userId };
  } else if (caller.role !== UserRole.SUPER_ADMIN) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const { limit, skip } = getPaginationParams(query, 20);
  
  // Commission is not implemented as a separate transaction type
  // Return empty for now - commission is calculated from shipment margins
  return { items: [], total: 0 };
};

/**
 * List refunds (scoped by role)
 */
const listRefundsService = async (query, caller) => {
  let filter = {};
  
  if (caller.role === UserRole.MERCHANT) {
    filter = { userId: caller.userId };
  } else if (caller.role === UserRole.DISTRIBUTOR) {
    // Distributor can see refunds for their merchants
    const merchantIds = (await userRepository.findAll({ invitedBy: caller.userId, deletedAt: null }, '_id'))
      .map(u => u._id);
    filter = { userId: { $in: merchantIds } };
  } else if (caller.role !== UserRole.SUPER_ADMIN) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const { limit, skip } = getPaginationParams(query, 20);
  
  const [refunds, total] = await financeRepository.findAllRefundsPaginated(filter, { skip, limit });

  return { items: refunds, total };
};

/**
 * List recharge requests (scoped by role)
 */
const listRechargeRequestsService = async (query, caller) => {
  let filter = {};

  if (caller.role === UserRole.DISTRIBUTOR) {
    filter = { userId: caller.userId };
  } else if (caller.role === UserRole.SUPER_ADMIN) {
    // SA can filter by status
    if (query.status) filter.status = query.status;
  } else {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const { limit, skip } = getPaginationParams(query, 20);
  const [requests, total] = await financeRepository.findRechargeRequestsPaginated(filter, { skip, limit });
  return { items: requests, total };
};

/**
 * Approve recharge request
 */
const approveRechargeRequestService = async (requestId, caller) => {
  if (caller.role !== UserRole.SUPER_ADMIN) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const request = await financeRepository.findRechargeRequestById(requestId);
  if (!request) {
    throw Object.assign(new Error('Recharge request not found'), { statusCode: 404 });
  }
  if (request.status !== 'PENDING') {
    throw Object.assign(new Error('Request already processed'), { statusCode: 400 });
  }

  return runInTransaction(async (session) => {
    const reference = `RECHARGE-REQ-${requestId}`;
    const { wallet, transaction } = await applyTransaction(
      session,
      request.userId._id.toString(),
      TransactionType.TOPUP,
      request.amount,
      {
        performedBy: caller.userId,
        note: `Recharge request approved by admin`,
        reference,
      },
    );

    await financeRepository.updateRechargeRequest(
      requestId,
      {
        status: 'APPROVED',
        transactionId: transaction._id,
        processedBy: caller.userId,
        processedAt: new Date(),
      },
      session,
    );

    try {
      await createNotification(request.userId._id.toString(), {
        title: 'Recharge Request Approved',
        message: `Your recharge request of ₹${request.amount.toLocaleString('en-IN')} has been approved and credited to your wallet.`,
        type: 'PAYMENT',
        meta: { requestId, reference },
      });
    } catch (_) {}

    return { wallet, transaction };
  });
};

/**
 * Reject recharge request
 */
const rejectRechargeRequestService = async (requestId, dto, caller) => {
  const { reason } = dto;

  if (caller.role !== UserRole.SUPER_ADMIN) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const request = await financeRepository.findRechargeRequestById(requestId);
  if (!request) {
    throw Object.assign(new Error('Recharge request not found'), { statusCode: 404 });
  }
  if (request.status !== 'PENDING') {
    throw Object.assign(new Error('Request already processed'), { statusCode: 400 });
  }

  await financeRepository.updateRechargeRequest(requestId, {
    status: 'REJECTED',
    rejectionReason: reason || null,
    processedBy: caller.userId,
    processedAt: new Date(),
  });

  try {
    await createNotification(request.userId._id.toString(), {
      title: 'Recharge Request Rejected',
      message: `Your recharge request of ₹${request.amount.toLocaleString('en-IN')} was rejected.${reason ? ` Reason: ${reason}` : ''}`,
      type: 'PAYMENT',
      meta: { requestId, reason },
    });
  } catch (_) {}

  return { success: true };
};

/**
 * Create a recharge request (Distributor submits to SA for manual top-up)
 */
const createRechargeRequestService = async (dto, caller) => {
  if (caller.role !== UserRole.DISTRIBUTOR) {
    throw Object.assign(new Error('Only distributors can submit recharge requests'), { statusCode: 403 });
  }

  const { amount, paymentMethod, referenceId } = dto;
  const { RechargeRequest } = require('../recharge-request.model');

  const request = await RechargeRequest.create({
    userId: caller.userId,
    amount,
    paymentMethod,
    referenceId: referenceId || null,
    status: 'PENDING',
  });

  return request;
};

module.exports = {
  getAdminStatsService,
  rechargeDistributorWalletService,
  listCommissionService,
  listRefundsService,
  listRechargeRequestsService,
  createRechargeRequestService,
  approveRechargeRequestService,
  rejectRechargeRequestService,
};
