'use strict';

const crypto = require('crypto');
const Razorpay = require('razorpay');
const mongoose = require('mongoose');
const { env } = require('../../config/env');
const { Payment } = require('./payment.model');
const { Wallet, Transaction } = require('./finance.model');
const { UserRole, PaymentStatus, TransactionType } = require('../../constants');
const { runInTransaction } = require('../../utils/transaction');
const { applyTransaction } = require('./finance.service');
const { createNotification } = require('../notifications/notification.service');
const { getPaginationParams } = require('../../utils/pagination');
const logger = require('../../utils/logger');

let razorpayClient = null;

const getRazorpay = () => {
  if (razorpayClient) return razorpayClient;
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw Object.assign(new Error('Razorpay is not configured'), { statusCode: 503 });
  }
  razorpayClient = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
  return razorpayClient;
};

const handleRazorpayError = (error) => {
  logger.error('razorpay_api_error', { 
    error: error.message, 
    code: error.code, 
    statusCode: error.statusCode 
  });

  // Map Razorpay error codes to appropriate HTTP status codes
  const errorMap = {
    'BAD_REQUEST_ERROR': 400,
    'INVALID_SIGNATURE_ERROR': 400,
    'INVALID_ORDER_ERROR': 400,
    'INVALID_PAYMENT_ERROR': 400,
    'INVALID_CURRENCY': 400,
    'INVALID_AMOUNT': 400,
    'GATEWAY_ERROR': 502,
    'SERVER_ERROR': 502,
    'AUTHENTICATION_ERROR': 401,
    'AUTHORIZATION_ERROR': 403,
    'RATE_LIMIT_ERROR': 429,
  };

  const statusCode = errorMap[error.code] || 502;
  const message = error.description || error.message || 'Razorpay API error';

  return Object.assign(new Error(message), { 
    statusCode, 
    code: error.code,
    originalError: error 
  });
};

const toPaise = (amountRupees) => {
  const amount = Number(amountRupees);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error('Amount must be a positive number'), { statusCode: 400 });
  }
  const amountPaise = Math.round(amount * 100);
  if (Math.abs(amountPaise / 100 - amount) > 0.000001) {
    throw Object.assign(new Error('Amount can have at most two decimal places'), { statusCode: 400 });
  }
  return amountPaise;
};

const timingSafeStringEqual = (a, b, throwOnError = false) => {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) {
    if (throwOnError) {
      throw new RangeError('Input buffers must have the same byte length');
    }
    return false;
  }
  return crypto.timingSafeEqual(left, right);
};

const verifyRazorpaySignature = (orderId, razorpayPaymentId, signature) => {
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${razorpayPaymentId}`)
    .digest('hex');
  return timingSafeStringEqual(expected, signature, true);
};

const verifyWebhookSignature = (rawBody, signature) => {
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    throw Object.assign(new Error('Razorpay webhook secret is not configured'), { statusCode: 503 });
  }
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return timingSafeStringEqual(expected, signature, false);
};

const normalizeVerifyDto = (dto) => ({
  razorpayOrderId: dto.razorpayOrderId || dto.orderId || dto.razorpay_order_id,
  razorpayPaymentId: dto.razorpayPaymentId || dto.razorpay_payment_id,
  razorpaySignature: dto.signature || dto.razorpaySignature || dto.razorpay_signature,
});

const ensureWalletTopupRole = (caller) => {
  if (![UserRole.MERCHANT, UserRole.DISTRIBUTOR, UserRole.SUPER_ADMIN].includes(caller.role)) {
    throw Object.assign(new Error('Only Merchants, Distributors and Super Admin can add money to their wallet'), { statusCode: 403 });
  }
};

const buildPaymentMetadata = (rzpPayment, extra = {}) => ({
  razorpay: {
    id: rzpPayment.id,
    order_id: rzpPayment.order_id,
    status: rzpPayment.status,
    method: rzpPayment.method || null,
    amount: rzpPayment.amount,
    currency: rzpPayment.currency,
    captured: rzpPayment.captured === true,
    fee: rzpPayment.fee || null,
    tax: rzpPayment.tax || null,
    email: rzpPayment.email || null,
    contact: rzpPayment.contact || null,
    acquirer_data: rzpPayment.acquirer_data || null,
    error_code: rzpPayment.error_code || null,
    error_description: rzpPayment.error_description || null,
    error_reason: rzpPayment.error_reason || null,
  },
  ...extra,
});

const validateCapturedPayment = (payment, rzpPayment) => {
  if (!rzpPayment) {
    throw Object.assign(new Error('Unable to fetch Razorpay payment'), { statusCode: 502 });
  }
  if (rzpPayment.order_id !== payment.razorpayOrderId) {
    throw Object.assign(new Error('Razorpay payment does not belong to this order'), { statusCode: 400 });
  }
  if (rzpPayment.amount !== payment.amountPaise) {
    throw Object.assign(new Error('Razorpay payment amount mismatch'), { statusCode: 400 });
  }
  if (rzpPayment.currency !== payment.currency) {
    throw Object.assign(new Error('Razorpay payment currency mismatch'), { statusCode: 400 });
  }
  if (rzpPayment.status !== 'captured' || rzpPayment.captured !== true) {
    if (rzpPayment.status === 'failed') {
      throw Object.assign(new Error('Razorpay payment failed'), { statusCode: 400 });
    }
    throw Object.assign(new Error('Razorpay payment is not captured yet'), { statusCode: 409 });
  }
};

const markPaymentFailed = async (payment, reason, rzpPayment = null) => {
  payment.status = PaymentStatus.FAILED;
  payment.failureReason = reason;
  payment.failedAt = new Date();
  if (rzpPayment) {
    payment.razorpayPaymentId = rzpPayment.id || payment.razorpayPaymentId;
    payment.razorpayPaymentStatus = rzpPayment.status || null;
    payment.paymentMethod = rzpPayment.method || null;
    payment.bank = rzpPayment.bank || null;
    payment.vpa = rzpPayment.vpa || null;
    payment.metadata = buildPaymentMetadata(rzpPayment);
  }
  await payment.save();
};

const formatProcessedPayment = async (payment, alreadyProcessed = false, session = null) => {
  const walletQuery = Wallet.findById(payment.walletId);
  const txQuery = payment.transactionId ? Transaction.findById(payment.transactionId) : null;
  const wallet = session ? await walletQuery.session(session) : await walletQuery;
  const transaction = txQuery ? (session ? await txQuery.session(session) : await txQuery) : null;
  return {
    success: true,
    alreadyProcessed,
    payment,
    wallet,
    balance: wallet?.balance,
    transaction,
  };
};

const creditCapturedPayment = async ({ payment, rzpPayment, signature = null, source, webhookEventId = null }) => {
  validateCapturedPayment(payment, rzpPayment);

  return runInTransaction(async (session) => {
    const query = {
      _id: payment._id,
      status: PaymentStatus.PENDING,
      transactionId: null,
    };
    const update = {
      $set: {
        status: PaymentStatus.SUCCESS,
        razorpayPaymentId: rzpPayment.id,
        signature,
        paymentMethod: rzpPayment.method || null,
        bank: rzpPayment.bank || null,
        vpa: rzpPayment.vpa || null,
        razorpayPaymentStatus: rzpPayment.status,
        capturedAt: new Date(),
        failureReason: null,
        failedAt: null,
        metadata: buildPaymentMetadata(rzpPayment, { source }),
      },
    };
    if (webhookEventId) {
      update.$addToSet = { webhookEventIds: webhookEventId };
    }

    const options = { returnDocument: 'after' };
    if (session) options.session = session;
    const claimed = await Payment.findOneAndUpdate(query, update, options);

    if (!claimed) {
      const existingQuery = Payment.findById(payment._id);
      const existing = session ? await existingQuery.session(session) : await existingQuery;
      if (existing?.status === PaymentStatus.SUCCESS) {
        return formatProcessedPayment(existing, true, session);
      }
      if (existing?.status === PaymentStatus.FAILED) {
        throw Object.assign(new Error('This payment has already been marked as failed'), { statusCode: 400 });
      }
      throw Object.assign(new Error('Payment is already being processed'), { statusCode: 409 });
    }

    const reference = `RAZORPAY-${rzpPayment.id}`;
    const { wallet, transaction } = await applyTransaction(
      session,
      claimed.userId.toString(),
      TransactionType.TOPUP,
      claimed.amountRupees,
      {
        reference,
        note: 'Razorpay wallet top-up',
        performedBy: claimed.userId,
      },
    );

    claimed.transactionId = transaction._id;
    await claimed.save({ session });

    try {
      await createNotification(claimed.userId.toString(), {
        title: 'Wallet Topped Up',
        message: `INR ${claimed.amountRupees.toLocaleString('en-IN')} has been added to your wallet.`,
        type: 'PAYMENT',
        meta: { paymentId: claimed._id, reference },
      });
    } catch (err) {
      logger.warn('payment_notification_failed', { paymentId: claimed._id, error: err.message });
    }

    return {
      success: true,
      wallet,
      balance: wallet.balance,
      transaction,
      payment: claimed,
    };
  });
};

const createRazorpayOrderService = async (dto, caller) => {
  ensureWalletTopupRole(caller);

  const amountRupees = Number(dto.amount);
  const amountPaise = toPaise(amountRupees);
  if (amountRupees > env.RAZORPAY_MAX_TOPUP_AMOUNT) {
    throw Object.assign(new Error(`Maximum top-up amount is INR ${env.RAZORPAY_MAX_TOPUP_AMOUNT}`), { statusCode: 400 });
  }

  const wallet = await Wallet.findOne({ userId: caller.userId });
  if (!wallet) {
    // Auto-create wallet for SA on first top-up attempt
    if (caller.role === UserRole.SUPER_ADMIN) {
      await Wallet.create({ userId: caller.userId, balance: 0 });
    } else {
      throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
    }
  } else if (!wallet.isActive) {
    throw Object.assign(new Error('Wallet is inactive'), { statusCode: 400 });
  }

  const receipt = `vx_${Date.now()}_${String(caller.userId).slice(-8)}`;
  let order;
  try {
    order = await getRazorpay().orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        userId: String(caller.userId),
        walletId: String(wallet._id),
        role: caller.role,
        purpose: 'wallet_topup',
      },
      // Orders expire after 24 hours by default in Razorpay
      // We'll track expiration in our Payment document
    });
  } catch (error) {
    throw handleRazorpayError(error);
  }

  const payment = await Payment.create({
    userId: caller.userId,
    walletId: wallet._id,
    razorpayOrderId: order.id,
    amount: amountRupees,
    amountRupees,
    amountPaise,
    currency: order.currency || 'INR',
    status: PaymentStatus.PENDING,
    metadata: {
      order: {
        id: order.id,
        receipt: order.receipt,
        status: order.status,
        attempts: order.attempts,
      },
      source: dto.source || 'checkout',
    },
  });

  logger.info('razorpay_order_created', {
    paymentId: payment._id,
    userId: caller.userId,
    razorpayOrderId: order.id,
    amountRupees,
    amountPaise,
  });

  return {
    paymentId: payment._id,
    razorpayOrderId: order.id,
    orderId: order.id,
    amount: amountPaise,
    amountRupees,
    amountPaise,
    currency: order.currency || 'INR',
    keyId: env.RAZORPAY_KEY_ID,
  };
};

const verifyPaymentService = async (dto, caller) => {
  ensureWalletTopupRole(caller);

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = normalizeVerifyDto(dto);
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw Object.assign(new Error('Razorpay order id, payment id and signature are required'), { statusCode: 400 });
  }

  const payment = await Payment.findOne({ razorpayOrderId, userId: caller.userId });
  if (!payment) throw Object.assign(new Error('Payment record not found'), { statusCode: 404 });

  if (payment.status === PaymentStatus.SUCCESS) {
    return formatProcessedPayment(payment, true);
  }
  if (payment.status === PaymentStatus.FAILED) {
    throw Object.assign(new Error('This payment has already been marked as failed'), { statusCode: 400 });
  }

  let isValidSig = false;
  try {
    isValidSig = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  } catch (err) {
    isValidSig = false;
  }

  if (!isValidSig) {
    await markPaymentFailed(payment, 'Invalid Razorpay payment signature');
    throw Object.assign(new Error('Payment verification failed: invalid signature'), { statusCode: 400 });
  }

  let rzpPayment;
  try {
    rzpPayment = await getRazorpay().payments.fetch(razorpayPaymentId);
  } catch (error) {
    throw handleRazorpayError(error);
  }
  try {
    validateCapturedPayment(payment, rzpPayment);
  } catch (err) {
    if (rzpPayment?.status === 'failed') {
      await markPaymentFailed(payment, rzpPayment.error_description || err.message, rzpPayment);
    }
    throw err;
  }

  return creditCapturedPayment({
    payment,
    rzpPayment,
    signature: razorpaySignature,
    source: 'checkout_verify',
  });
};

const listPaymentsService = async (query, caller) => {
  const filter = {};

  if (caller.role === UserRole.SUPER_ADMIN) {
    if (query.userId) filter.userId = query.userId;
  } else if ([UserRole.DISTRIBUTOR, UserRole.MERCHANT].includes(caller.role)) {
    filter.userId = caller.userId;
  } else {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  if (query.status) filter.status = query.status;
  if (query.amount) filter.amountRupees = query.amount;
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) filter.createdAt.$lte = new Date(query.dateTo);
  }

  const { limit, skip } = getPaginationParams(query, 20);
  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate('userId', 'firstName lastName email role companyName phone')
      .populate('walletId', 'balance currency')
      .populate('transactionId', 'type amount reference createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);

  return { items: payments, total };
};

const getPaymentService = async (id, caller) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw Object.assign(new Error('Invalid payment ID'), { statusCode: 400 });
  }

  const filter = { _id: id };
  if (caller.role !== UserRole.SUPER_ADMIN) {
    filter.userId = caller.userId;
  }

  const payment = await Payment.findOne(filter)
    .populate('userId', 'firstName lastName email role companyName phone')
    .populate('walletId', 'balance currency')
    .populate('transactionId', 'type amount reference balanceBefore balanceAfter createdAt');

  if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
  return payment;
};

const handleCapturedWebhook = async (rzpPaymentFromPayload, webhookEventId) => {
  const orderId = rzpPaymentFromPayload?.order_id;
  const razorpayPaymentId = rzpPaymentFromPayload?.id;
  if (!orderId || !razorpayPaymentId) return { ignored: true };

  const payment = await Payment.findOne({ razorpayOrderId: orderId });
  if (!payment) return { ignored: true };
  if (payment.status === PaymentStatus.SUCCESS) {
    if (webhookEventId) {
      await Payment.updateOne({ _id: payment._id }, { $addToSet: { webhookEventIds: webhookEventId } });
    }
    return { alreadyProcessed: true };
  }
  if (payment.status === PaymentStatus.FAILED) return { ignored: true };

  let rzpPayment;
  try {
    rzpPayment = await getRazorpay().payments.fetch(razorpayPaymentId);
  } catch (error) {
    logger.error('razorpay_webhook_fetch_payment_failed', { paymentId: razorpayPaymentId, error: error.message });
    return { ignored: true };
  }
  return creditCapturedPayment({
    payment,
    rzpPayment,
    source: 'webhook_payment_captured',
    webhookEventId,
  });
};

const handleFailedWebhook = async (rzpPayment, webhookEventId) => {
  const orderId = rzpPayment?.order_id;
  if (!orderId) return { ignored: true };

  const update = {
    $set: {
      status: PaymentStatus.FAILED,
      razorpayPaymentId: rzpPayment.id || null,
      razorpayPaymentStatus: rzpPayment.status || 'failed',
      paymentMethod: rzpPayment.method || null,
      bank: rzpPayment.bank || null,
      vpa: rzpPayment.vpa || null,
      failureReason: rzpPayment.error_description || rzpPayment.error_reason || 'Payment failed',
      failedAt: new Date(),
      metadata: buildPaymentMetadata(rzpPayment, { source: 'webhook_payment_failed' }),
    },
  };
  if (webhookEventId) {
    update.$addToSet = { webhookEventIds: webhookEventId };
  }

  await Payment.findOneAndUpdate(
    { razorpayOrderId: orderId, status: PaymentStatus.PENDING },
    update,
  );
  return { success: true };
};

const handleWebhookEvent = async (event, payload, webhookEventId = null) => {
  const rzpPayment = payload?.payment?.entity;
  const rzpOrder = payload?.order?.entity;
  const rzpRefund = payload?.refund?.entity;

  // Payment events
  if (event === 'payment.captured') {
    return handleCapturedWebhook(rzpPayment, webhookEventId);
  }

  if (event === 'payment.failed') {
    return handleFailedWebhook(rzpPayment, webhookEventId);
  }

  if (event === 'payment.authorized') {
    // Payment authorized but not yet captured (for manual capture mode)
    logger.info('razorpay_payment_authorized', { paymentId: rzpPayment?.id, orderId: rzpPayment?.order_id });
    return { ignored: true }; // We use auto-capture, so this is informational
  }

  // Order events
  if (event === 'order.paid') {
    const payments = payload?.payment?.entity ? [payload.payment.entity] : [];
    if (payments.length === 0) return { ignored: true };
    return handleCapturedWebhook(payments[0], webhookEventId);
  }

  if (event === 'order.created') {
    logger.info('razorpay_order_created_webhook', { orderId: rzpOrder?.id });
    return { ignored: true };
  }

  // Refund events
  if (event === 'refund.processed') {
    return handleRefundWebhook(rzpRefund, webhookEventId);
  }

  if (event === 'refund.failed') {
    logger.warn('razorpay_refund_failed', { refundId: rzpRefund?.id, paymentId: rzpRefund?.payment_id });
    return { ignored: true };
  }

  // Settlement events
  if (event === 'settlement.processed') {
    logger.info('razorpay_settlement_processed', { settlementId: payload?.settlement?.entity?.id });
    return { ignored: true };
  }

  logger.info('razorpay_webhook_ignored', { event, webhookEventId });
  return { ignored: true };
};

// ─── Refund Handling ─────────────────────────────────────────────────────────────

const refundPaymentService = async (paymentId, amount, reason, caller) => {
  if (!mongoose.Types.ObjectId.isValid(paymentId)) {
    throw Object.assign(new Error('Invalid payment ID'), { statusCode: 400 });
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });

  // Role-based access
  if (caller.role !== UserRole.SUPER_ADMIN) {
    if (payment.userId.toString() !== caller.userId) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
  }

  if (payment.status !== PaymentStatus.SUCCESS) {
    throw Object.assign(new Error('Only successful payments can be refunded'), { statusCode: 400 });
  }

  if (!payment.razorpayPaymentId) {
    throw Object.assign(new Error('No Razorpay payment ID found for this payment'), { statusCode: 400 });
  }

  // Check if already refunded
  if (payment.status === PaymentStatus.REFUNDED) {
    throw Object.assign(new Error('Payment already refunded'), { statusCode: 400 });
  }

  const refundAmountPaise = amount ? toPaise(amount) : payment.amountPaise;

  try {
    const rzpRefund = await getRazorpay().payments.refund(payment.razorpayPaymentId, {
      amount: refundAmountPaise,
      notes: {
        originalPaymentId: payment._id.toString(),
        userId: payment.userId.toString(),
        reason,
      },
    });

    // Update payment status
    payment.status = PaymentStatus.REFUNDED;
    payment.metadata = {
      ...payment.metadata,
      refund: {
        id: rzpRefund.id,
        amount: rzpRefund.amount,
        status: rzpRefund.status,
        created_at: rzpRefund.created_at,
        reason,
      },
    };
    await payment.save();

    // Debit wallet — reverse the earlier TOPUP credit so balance reflects the card refund
    return runInTransaction(async (session) => {
      const { applyTransaction } = require('./finance.service');
      const refundAmountRupees = amount || payment.amountRupees;
      const reference = `REFUND-${rzpRefund.id}`;
      const { wallet, transaction } = await applyTransaction(
        session,
        payment.userId.toString(),
        TransactionType.DEBIT,   // debit — money has left the wallet back to the user's card
        refundAmountRupees,
        {
          reference,
          note: `Razorpay refund for payment ${payment._id}`,
          performedBy: caller.userId,
        },
      );

      try {
        await createNotification(payment.userId.toString(), {
          title: 'Payment Refunded',
          message: `INR ${refundAmountRupees.toLocaleString('en-IN')} has been refunded to your bank/card via Razorpay.`,
          type: 'PAYMENT',
          meta: { refundId: rzpRefund.id, originalPaymentId: payment._id },
        });
      } catch (err) {
        logger.warn('refund_notification_failed', { paymentId: payment._id, error: err.message });
      }

      return {
        success: true,
        refund: rzpRefund,
        wallet,
        balance: wallet.balance,
        transaction,
      };
    });
  } catch (error) {
    logger.error('razorpay_refund_failed', { paymentId: payment._id, error: error.message });
    throw Object.assign(new Error('Refund failed: ' + error.message), { statusCode: 502 });
  }
};

const handleRefundWebhook = async (rzpRefund, webhookEventId) => {
  const paymentId = rzpRefund?.notes?.originalPaymentId;
  if (!paymentId) return { ignored: true };

  const payment = await Payment.findById(paymentId);
  if (!payment) return { ignored: true };

  if (payment.status === PaymentStatus.REFUNDED) {
    if (webhookEventId) {
      await Payment.updateOne({ _id: payment._id }, { $addToSet: { webhookEventIds: webhookEventId } });
    }
    return { alreadyProcessed: true };
  }

  // Update payment with refund info
  await Payment.updateOne(
    { _id: payment._id },
    {
      $set: {
        status: PaymentStatus.REFUNDED,
        'metadata.refund': {
          id: rzpRefund.id,
          amount: rzpRefund.amount,
          status: rzpRefund.status,
          created_at: rzpRefund.created_at,
        },
      },
      $addToSet: webhookEventId ? { webhookEventIds: webhookEventId } : undefined,
    }
  );

  return { success: true };
};

module.exports = {
  createRazorpayOrderService,
  verifyPaymentService,
  listPaymentsService,
  getPaymentService,
  handleWebhookEvent,
  verifyRazorpaySignature,
  verifyWebhookSignature,
  getRazorpay,
  refundPaymentService,
};
