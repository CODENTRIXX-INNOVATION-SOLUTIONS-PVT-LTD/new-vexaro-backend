const mongoose = require('mongoose');
const { PaymentStatus } = require('../../constants');

// ─── Payment Schema ────────────────────────────────────────────────────────────
// One document per Razorpay order attempt.
// razorpayOrderId is unique — acts as idempotency key at the order level.
// razorpayPaymentId uniqueness prevents double-credit on webhook replays.
const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    walletId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Wallet',
      required: true,
    },

    // ── Razorpay identifiers ──────────────────────────────────────────────────
    razorpayOrderId: {
      type:     String,
      required: true,
      unique:   true,   // prevents duplicate orders being stored
      trim:     true,
    },
    razorpayPaymentId: {
      type:    String,
      default: null,
      trim:    true,
      // index defined via paymentSchema.index() below — sparse: true there
    },
    signature: {
      type:    String,
      default: null,
    },

    // ── Financial fields ──────────────────────────────────────────────────────
    amount: {
      type:     Number,
      required: true,
      min:      [100, 'Minimum topup is ₹100'],
    },
    currency: {
      type:    String,
      default: 'INR',
    },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      index:   true,
    },

    // ── Payment metadata (populated on verify/webhook) ────────────────────────
    paymentMethod: {
      type:    String,   // 'upi', 'card', 'netbanking', 'wallet', etc.
      default: null,
    },
    bank: {
      type:    String,
      default: null,
    },
    failureReason: {
      type:    String,
      default: null,
    },

    // ── Linked transaction (set after wallet is credited) ─────────────────────
    transactionId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Transaction',
      default: null,
    },

    // ── Arbitrary metadata from Razorpay event payloads ──────────────────────
    metadata: {
      type:    mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

// Index for fast lookups by razorpayPaymentId on webhook events
paymentSchema.index({ razorpayPaymentId: 1 }, { sparse: true });
// Compound index for payment history queries
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ userId: 1, status: 1, createdAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = { Payment, PaymentStatus };
