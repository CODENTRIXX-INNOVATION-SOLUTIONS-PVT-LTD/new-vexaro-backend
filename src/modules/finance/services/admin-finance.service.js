'use strict';

const { UserRole, TransactionType, SystemConfig } = require('../../../constants');
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
 * Recharge distributor wallet (debit admin wallet → credit distributor wallet atomically)
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

  // Check admin wallet balance
  const adminWallet = await financeRepository.findWalletByUserId(caller.userId);
  if (!adminWallet) {
    throw Object.assign(new Error('Admin wallet not found. Please top up your wallet first via Razorpay.'), { statusCode: 404 });
  }
  if (adminWallet.balance < amount) {
    throw Object.assign(
      new Error(`Insufficient admin wallet balance. Available: ₹${adminWallet.balance.toLocaleString('en-IN')}, Required: ₹${amount.toLocaleString('en-IN')}`),
      { statusCode: 400 },
    );
  }

  return runInTransaction(async (session) => {
    const { createWalletService } = require('./wallet.service');
    let walletDoc = await financeRepository.findWalletByUserId(distributorId, session);
    if (!walletDoc) {
      walletDoc = await createWalletService(distributorId, session);
    }
    const hasRecharge = await financeRepository.hasCompletedRecharge(walletDoc._id, session);
    if (!hasRecharge && amount < SystemConfig.WALLET_MIN_FIRST_TOPUP) {
      throw Object.assign(
        new Error(`First wallet top-up must be at least ₹${SystemConfig.WALLET_MIN_FIRST_TOPUP.toLocaleString('en-IN')} (includes ₹${SystemConfig.WALLET_RESERVE_AMOUNT.toLocaleString('en-IN')} mandatory security reserve)`),
        { statusCode: 400 }
      );
    }

    const baseReference = `ADMIN-TRANSFER-${Date.now()}`;

    // Debit admin wallet — unique reference suffix prevents idempotency clash with credit
    const { transaction: adminTx } = await applyTransaction(
      session,
      caller.userId,
      TransactionType.TRANSFER_DEBIT,
      amount,
      {
        performedBy: caller.userId,
        note: `Transfer to distributor: ${distributor.email || distributor.companyName}`,
        reference: `${baseReference}-DEBIT`,
        paymentMethod,
        referenceId,
      },
    );

    // Credit distributor wallet — separate reference so idempotency check doesn't skip this step
    const { wallet, transaction } = await applyTransaction(
      session,
      distributorId,
      TransactionType.TRANSFER_CREDIT,
      amount,
      {
        performedBy: caller.userId,
        note: `Wallet funded by admin via ${paymentMethod}`,
        reference: `${baseReference}-CREDIT`,
        paymentMethod,
        referenceId,
      },
    );

    // Update distributor wallet last recharge info
    wallet.lastRechargeAmount = amount;
    wallet.lastRechargeDate = new Date();
    await wallet.save({ session });

    try {
      await createNotification(distributorId, {
        senderId: caller.userId,
        title: 'Wallet Funded',
        message: `₹${amount.toLocaleString('en-IN')} has been added to your wallet by the admin.`,
        type: 'PAYMENT',
        meta: { reference: baseReference, paymentMethod },
      });
    } catch (_) {}

    return { wallet, transaction, adminTransaction: adminTx };
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
 * Atomically debits the admin wallet and credits the distributor wallet.
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

  // Check admin wallet has sufficient balance before entering the transaction
  const adminWallet = await financeRepository.findWalletByUserId(caller.userId);
  if (!adminWallet) {
    // Auto-create an empty wallet for SA so they get a proper balance error
    const { Wallet } = require('../finance.model');
    await Wallet.create({ userId: caller.userId, balance: 0 });
    throw Object.assign(
      new Error('Your admin wallet has ₹0 balance. Please top up via Razorpay before approving requests.'),
      { statusCode: 400 },
    );
  }
  if (adminWallet.balance < request.amount) {
    throw Object.assign(
      new Error(
        `Insufficient admin wallet balance. Your balance: ₹${adminWallet.balance.toLocaleString('en-IN')}, Required: ₹${request.amount.toLocaleString('en-IN')}. Please top up via Razorpay first.`,
      ),
      { statusCode: 400 },
    );
  }

  return runInTransaction(async (session) => {
    const { createWalletService } = require('./wallet.service');
    const distributorId = request.userId._id.toString();
    let walletDoc = await financeRepository.findWalletByUserId(distributorId, session);
    if (!walletDoc) {
      walletDoc = await createWalletService(distributorId, session);
    }
    const hasRecharge = await financeRepository.hasCompletedRecharge(walletDoc._id, session);
    if (!hasRecharge && request.amount < SystemConfig.WALLET_MIN_FIRST_TOPUP) {
      throw Object.assign(
        new Error(`First wallet top-up must be at least ₹${SystemConfig.WALLET_MIN_FIRST_TOPUP.toLocaleString('en-IN')} (includes ₹${SystemConfig.WALLET_RESERVE_AMOUNT.toLocaleString('en-IN')} mandatory security reserve)`),
        { statusCode: 400 }
      );
    }

    const baseReference = `RECHARGE-REQ-${requestId}`;

    // Debit admin wallet first — unique reference suffix prevents idempotency clash with credit
    const { transaction: adminTx } = await applyTransaction(
      session,
      caller.userId,
      TransactionType.TRANSFER_DEBIT,
      request.amount,
      {
        performedBy: caller.userId,
        note: `Recharge request approved — transfer to distributor`,
        reference: `${baseReference}-DEBIT`,
      },
    );

    // Credit distributor wallet — separate reference so idempotency check doesn't skip this step
    const { wallet, transaction } = await applyTransaction(
      session,
      distributorId,
      TransactionType.TRANSFER_CREDIT,
      request.amount,
      {
        performedBy: caller.userId,
        note: `Recharge request approved by admin`,
        reference: `${baseReference}-CREDIT`,
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
      await createNotification(distributorId, {
        title: 'Recharge Request Approved',
        message: `Your recharge request of ₹${request.amount.toLocaleString('en-IN')} has been approved and credited to your wallet.`,
        type: 'PAYMENT',
        meta: { requestId, reference: baseReference },
      });
    } catch (_) {}

    return { wallet, transaction, adminTransaction: adminTx };
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

const createRechargeRequestService = async (dto, caller) => {
  if (caller.role !== UserRole.DISTRIBUTOR) {
    throw Object.assign(new Error('Only distributors can submit recharge requests'), { statusCode: 403 });
  }

  const { amount, paymentMethod, referenceId } = dto;
  const { RechargeRequest } = require('../recharge-request.model');

  let wallet = await financeRepository.findWalletByUserId(caller.userId);
  if (!wallet) {
    const { createWalletService } = require('./wallet.service');
    wallet = await createWalletService(caller.userId);
  }
  const hasRecharge = await financeRepository.hasCompletedRecharge(wallet._id);
  if (!hasRecharge && amount < SystemConfig.WALLET_MIN_FIRST_TOPUP) {
    throw Object.assign(
      new Error(`First wallet top-up must be at least ₹${SystemConfig.WALLET_MIN_FIRST_TOPUP.toLocaleString('en-IN')} (includes ₹${SystemConfig.WALLET_RESERVE_AMOUNT.toLocaleString('en-IN')} mandatory security reserve)`),
      { statusCode: 400 }
    );
  }

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
