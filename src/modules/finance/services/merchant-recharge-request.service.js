'use strict';

const { UserRole, TransactionType } = require('../../../constants');
const { getPaginationParams } = require('../../../utils/pagination');
const { runInTransaction } = require('../../../utils/transaction');
const userRepository = require('../../users/user.repository');
const financeRepository = require('../finance.repository');
const { applyTransaction } = require('./payment.service');
const { createNotification } = require('../../notifications/notification.service');
const { MerchantRechargeRequest } = require('../merchant-recharge-request.model');
const { createWalletService } = require('./wallet.service');
const { validateTopupAmountForPolicy } = require('../wallet-topup-policy');

/**
 * Merchant submits a top-up request to their distributor.
 */
const createMerchantRechargeRequestService = async (dto, caller) => {
  if (caller.role !== UserRole.MERCHANT) {
    throw Object.assign(new Error('Only merchants can submit top-up requests'), { statusCode: 403 });
  }

  const { amount, note } = dto;

  // Verify merchant exists and determine who should handle the request.
  const merchant = await userRepository.findOne({ _id: caller.userId, deletedAt: null });
  if (!merchant) {
    throw Object.assign(new Error('Merchant not found'), { statusCode: 404 });
  }

  let distributorId = null;
  if (merchant.invitedBy) {
    const distributor = await userRepository.findOne({ _id: merchant.invitedBy, deletedAt: null });
    if (!distributor || distributor.role !== UserRole.DISTRIBUTOR) {
      throw Object.assign(new Error('Your distributor account was not found'), { statusCode: 404 });
    }
    distributorId = merchant.invitedBy;
  }

  let wallet = await financeRepository.findWalletByUserId(caller.userId);
  if (!wallet) {
    wallet = await createWalletService(caller.userId);
  }
  await validateTopupAmountForPolicy({ wallet, role: caller.role, amount });

  const request = await MerchantRechargeRequest.create({
    merchantId: caller.userId,
    distributorId,
    amount,
    note: note || null,
    status: 'PENDING',
  });

  // Notify distributor for old flow, otherwise notify Super Admins for direct merchants.
  try {
    const notification = {
      senderId: merchant._id,
      title: 'Merchant Wallet Top-up Request',
      message: `${merchant.companyName || merchant.firstName} has requested a wallet top-up of ₹${amount.toLocaleString('en-IN')}.`,
      type: 'PAYMENT',
      meta: { requestId: request._id },
    };

    if (distributorId) {
      await createNotification(distributorId.toString(), notification);
    } else {
      const admins = await userRepository.findAll({ role: UserRole.SUPER_ADMIN, deletedAt: null }, '_id');
      await Promise.all(admins.map((admin) => createNotification(admin._id.toString(), notification)));
    }
  } catch (_) { }

  return request;
};

/**
 * List merchant recharge requests.
 * Merchant sees their own. Distributor sees incoming (their merchants).
 */
const listMerchantRechargeRequestsService = async (query, caller) => {
  let filter = {};

  if (caller.role === UserRole.MERCHANT) {
    filter = { merchantId: caller.userId };
  } else if (caller.role === UserRole.DISTRIBUTOR) {
    filter = { distributorId: caller.userId };
    if (query.status) filter.status = query.status;
  } else if (caller.role === UserRole.SUPER_ADMIN) {
    if (query.directOnly) filter.distributorId = null;
    if (query.distributorId) filter.distributorId = query.distributorId;
    if (query.merchantId) filter.merchantId = query.merchantId;
    if (query.status) filter.status = query.status;
  } else {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const { limit, skip } = getPaginationParams(query, 20);

  const [items, total] = await Promise.all([
    MerchantRechargeRequest.find(filter)
      .populate('merchantId', 'firstName lastName email companyName')
      .populate('distributorId', 'firstName lastName email companyName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MerchantRechargeRequest.countDocuments(filter),
  ]);

  return { items, total };
};

/**
 * Distributor approves — transfers from distributor wallet to merchant wallet atomically.
 */
const approveMerchantRechargeRequestService = async (requestId, caller) => {
  if (![UserRole.DISTRIBUTOR, UserRole.SUPER_ADMIN].includes(caller.role)) {
    throw Object.assign(new Error('Only distributors or Super Admin can approve merchant top-up requests'), { statusCode: 403 });
  }

  const request = await MerchantRechargeRequest.findById(requestId)
    .populate('merchantId', 'firstName lastName email companyName invitedBy');

  if (!request) {
    throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  }
  if (caller.role === UserRole.SUPER_ADMIN && request.distributorId) {
    throw Object.assign(new Error('Access denied - this request belongs to a distributor'), { statusCode: 403 });
  }
  if (caller.role === UserRole.DISTRIBUTOR && (!request.distributorId || request.distributorId.toString() !== caller.userId)) {
    throw Object.assign(new Error('Access denied — this request is not for your merchant'), { statusCode: 403 });
  }
  if (request.status !== 'PENDING') {
    throw Object.assign(new Error('Request already processed'), { statusCode: 400 });
  }

  // Check distributor has sufficient balance
  const distributorWallet = await financeRepository.findWalletByUserId(caller.userId);
  if (!distributorWallet) {
    throw Object.assign(new Error('Your wallet was not found'), { statusCode: 404 });
  }
  if (distributorWallet.balance < request.amount) {
    throw Object.assign(
      new Error(
        `Insufficient wallet balance. Available: ₹${distributorWallet.balance.toLocaleString('en-IN')}, Required: ₹${request.amount.toLocaleString('en-IN')}`,
      ),
      { statusCode: 400 },
    );
  }

  const approvalActorLabel = caller.role === UserRole.SUPER_ADMIN ? 'Super Admin' : 'distributor';

  return runInTransaction(async (session) => {
    const baseReference = `MERCHANT-RECHARGE-${requestId}`;
    const logger = require('../../../utils/logger');

    // Ensure merchant wallet exists before transaction
    const merchantWallet = await createWalletService(request.merchantId._id.toString(), session);
    logger.info('merchant_wallet_created_or_found', { merchantId: request.merchantId._id.toString(), walletId: merchantWallet._id });

    await validateTopupAmountForPolicy({ wallet: merchantWallet, role: UserRole.MERCHANT, amount: request.amount, session });

    // Debit distributor wallet — unique reference suffix prevents idempotency clash with credit
    const debitResult = await applyTransaction(
      session,
      caller.userId,
      TransactionType.TRANSFER_DEBIT,
      request.amount,
      {
        performedBy: caller.userId,
        note: `Merchant wallet top-up: ${request.merchantId?.companyName || request.merchantId?.email}`,
        reference: `${baseReference}-DEBIT`,
      },
    );
    logger.info('distributor_wallet_debited', { distributorId: caller.userId, amount: request.amount, balanceAfter: debitResult.wallet.balance });

    // Credit merchant wallet — separate reference so idempotency check doesn't skip this step
    const { wallet, transaction } = await applyTransaction(
      session,
      request.merchantId._id.toString(),
      TransactionType.TRANSFER_CREDIT,
      request.amount,
      {
        performedBy: caller.userId,
        note: `Wallet top-up approved by ${approvalActorLabel}`,
        reference: `${baseReference}-CREDIT`,
      },
    );
    logger.info('merchant_wallet_credited', { merchantId: request.merchantId._id.toString(), amount: request.amount, balanceAfter: wallet.balance, transactionId: transaction._id });

    await MerchantRechargeRequest.findByIdAndUpdate(
      requestId,
      {
        status: 'APPROVED',
        transactionId: transaction._id,
        processedBy: caller.userId,
        processedAt: new Date(),
      },
      { session },
    );

    try {
      await createNotification(request.merchantId._id.toString(), {
        title: 'Wallet Top-up Approved',
        message: `Your wallet top-up request of ₹${request.amount.toLocaleString('en-IN')} has been approved and credited.`,
        type: 'PAYMENT',
        meta: { requestId, reference: baseReference },
      });
    } catch (_) { }

    return { wallet, transaction };
  });
};

/**
 * Distributor rejects the merchant recharge request.
 */
const rejectMerchantRechargeRequestService = async (requestId, dto, caller) => {
  if (![UserRole.DISTRIBUTOR, UserRole.SUPER_ADMIN].includes(caller.role)) {
    throw Object.assign(new Error('Only distributors or Super Admin can reject merchant top-up requests'), { statusCode: 403 });
  }

  const request = await MerchantRechargeRequest.findById(requestId);
  if (!request) {
    throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  }
  if (caller.role === UserRole.SUPER_ADMIN && request.distributorId) {
    throw Object.assign(new Error('Access denied - this request belongs to a distributor'), { statusCode: 403 });
  }
  if (caller.role === UserRole.DISTRIBUTOR && (!request.distributorId || request.distributorId.toString() !== caller.userId)) {
    throw Object.assign(new Error('Access denied — this request is not for your merchant'), { statusCode: 403 });
  }
  if (request.status !== 'PENDING') {
    throw Object.assign(new Error('Request already processed'), { statusCode: 400 });
  }

  await MerchantRechargeRequest.findByIdAndUpdate(requestId, {
    status: 'REJECTED',
    rejectionReason: dto.reason || null,
    processedBy: caller.userId,
    processedAt: new Date(),
  });

  try {
    await createNotification(request.merchantId.toString(), {
      title: 'Wallet Top-up Request Rejected',
      message: `Your top-up request of ₹${request.amount.toLocaleString('en-IN')} was rejected.${dto.reason ? ` Reason: ${dto.reason}` : ''}`,
      type: 'PAYMENT',
      meta: { requestId },
    });
  } catch (_) { }

  return { success: true };
};

module.exports = {
  createMerchantRechargeRequestService,
  listMerchantRechargeRequestsService,
  approveMerchantRechargeRequestService,
  rejectMerchantRechargeRequestService,
};
