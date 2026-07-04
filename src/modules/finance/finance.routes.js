const { Router } = require("express");
const {
  authMiddleware,
  requireRole,
} = require("../../middleware/auth.middleware");
const { UserRole } = require("../../constants");
const c = require("./finance.controller");
const { validateRequest } = require("../../validation");
const schemas = require("../../validation/schemas/finance");
const {
  emptyObjectSchema,
} = require("../../validation/schemas/common/base.schemas");

const router = Router();
router.use(authMiddleware);

// ── Wallet ──────────────────────────────────────────────────────────────────
// GET  /api/finance/wallet          — own wallet balance
router.get(
  "/wallet",
  validateRequest({ query: emptyObjectSchema }),
  c.getMyWallet,
);
// GET  /api/finance/wallets         — SA/Distributor: list all wallets in scope
router.get(
  "/wallets",
  requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR),
  validateRequest({ query: schemas.listQuerySchema }),
  c.listWallets,
);
// POST /api/finance/topup           — SA/Distributor: add funds to a user's wallet
router.post(
  "/topup",
  requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR),
  validateRequest({ body: schemas.topupSchema }),
  c.topupWallet,
);
// POST /api/finance/refund          — SA: manually refund a user's wallet
router.post(
  "/refund",
  requireRole(UserRole.SUPER_ADMIN),
  validateRequest({ body: schemas.refundSchema }),
  c.refundWallet,
);
// POST /api/finance/transfer-to-merchant — Distributor: transfer funds to merchant wallet
router.post(
  "/transfer-to-merchant",
  requireRole(UserRole.DISTRIBUTOR),
  validateRequest({ body: schemas.transferToMerchantSchema }),
  c.transferToMerchant,
);

// ── Transactions ─────────────────────────────────────────────────────────────
// GET  /api/finance/transactions    — own transaction history (SA/Dist can add ?userId=)
router.get(
  "/transactions",
  validateRequest({ query: schemas.listQuerySchema }),
  c.listTransactions,
);

// ── COD Management ───────────────────────────────────────────────────────────
// GET  /api/finance/cod             — list COD records (scoped by role)
router.get(
  "/cod",
  validateRequest({ query: schemas.listQuerySchema }),
  c.listCOD,
);
// PATCH /api/finance/cod/:id/remit  — mark COD as remitted → credits merchant wallet
router.patch(
  "/cod/:id/remit",
  requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR),
  validateRequest({
    params: schemas.financeIdParamsSchema,
    body: schemas.remitCODSchema,
  }),
  c.remitCOD,
);

// ── Settlements ──────────────────────────────────────────────────────────────
// GET  /api/finance/settlements     — list settlements
router.get(
  "/settlements",
  validateRequest({ query: schemas.listQuerySchema }),
  c.listSettlements,
);
// POST /api/finance/settlements     — create a settlement request
router.post(
  "/settlements",
  requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR),
  validateRequest({ body: schemas.createSettlementSchema }),
  c.createSettlement,
);
// PATCH /api/finance/settlements/:id/process — SA marks as COMPLETED/FAILED
router.patch(
  "/settlements/:id/process",
  requireRole(UserRole.SUPER_ADMIN),
  validateRequest({
    params: schemas.financeIdParamsSchema,
    body: schemas.processSettlementSchema,
  }),
  c.processSettlement,
);

// ─── Refund Requests ────────────────────────────────────────────────────────────
// POST  /api/finance/refund-requests         — Merchant submits refund request
router.post(
  "/refund-requests",
  requireRole(UserRole.MERCHANT),
  validateRequest({ body: schemas.submitRefundRequestSchema }),
  c.submitRefundRequest,
);

// GET   /api/finance/refund-requests         — List refund requests (scoped by role)
router.get(
  "/refund-requests",
  validateRequest({ query: schemas.listQuerySchema }),
  c.listRefundRequests,
);

// PATCH /api/finance/refund-requests/:id/process — SA/Distributor approves or rejects refund request
router.patch(
  "/refund-requests/:id/process",
  requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR),
  validateRequest({
    params: schemas.refundRequestIdParamsSchema,
    body: schemas.processRefundRequestSchema,
  }),
  c.processRefundRequest,
);

// ── Razorpay Wallet Top-up ───────────────────────────────────────────────────
const rzp = require("./razorpay.controller");

// POST /api/finance/razorpay/create-order   — Merchant/Distributor/SuperAdmin: create Razorpay order
router.post(
  "/razorpay/create-order",
  requireRole(UserRole.MERCHANT, UserRole.DISTRIBUTOR, UserRole.SUPER_ADMIN),
  validateRequest({ body: schemas.createOrderSchema }),
  rzp.createOrder,
);
// POST /api/finance/razorpay/verify-payment — Merchant/Distributor/SuperAdmin: verify signature + credit wallet
router.post(
  "/razorpay/verify-payment",
  requireRole(UserRole.MERCHANT, UserRole.DISTRIBUTOR, UserRole.SUPER_ADMIN),
  validateRequest({ body: schemas.verifyPaymentSchema }),
  rzp.verifyPayment,
);
router.post(
  "/razorpay/verify",
  requireRole(UserRole.MERCHANT, UserRole.DISTRIBUTOR, UserRole.SUPER_ADMIN),
  validateRequest({ body: schemas.verifyPaymentSchema }),
  rzp.verifyPayment,
);

// ── Payment History ──────────────────────────────────────────────────────────
// GET  /api/finance/payments     — paginated payment history (role-scoped)
router.get(
  "/payments",
  validateRequest({ query: schemas.paymentListQuerySchema }),
  rzp.listPayments,
);
// GET  /api/finance/payments/:id — single payment detail (role-scoped)
router.get(
  "/payments/:id",
  validateRequest({ params: schemas.financeIdParamsSchema }),
  rzp.getPayment,
);

// POST /api/finance/payments/:id/refund — SA/User: refund payment via Razorpay
router.post(
  "/payments/:id/refund",
  validateRequest({
    params: schemas.financeIdParamsSchema,
    body: schemas.refundPaymentSchema,
  }),
  rzp.refundPayment,
);

// ── Admin Stats ───────────────────────────────────────────────────────────────
// GET  /api/finance/admin/stats  — SA: dashboard statistics
router.get(
  "/admin/stats",
  requireRole(UserRole.SUPER_ADMIN),
  validateRequest({ query: emptyObjectSchema }),
  c.getAdminStats,
);

// ── Distributor Wallet Recharge (Admin Manual) ──────────────────────────────────
// POST /api/finance/wallets/recharge — SA: manually recharge distributor wallet
router.post(
  "/wallets/recharge",
  requireRole(UserRole.SUPER_ADMIN),
  validateRequest({ body: schemas.rechargeWalletSchema }),
  c.rechargeDistributorWallet,
);

// ── Commission ─────────────────────────────────────────────────────────────────
// GET  /api/finance/commission    — list commission earnings (scoped by role)
router.get(
  "/commission",
  validateRequest({ query: schemas.listQuerySchema }),
  c.listCommission,
);

// ── Refunds ────────────────────────────────────────────────────────────────────
// GET  /api/finance/refunds       — list refunds (scoped by role)
router.get(
  "/refunds",
  validateRequest({ query: schemas.listQuerySchema }),
  c.listRefunds,
);

// ── Recharge Requests (Distributor Manual Recharge Requests) ──────────────────────
// POST /api/finance/recharge-requests         — Distributor: submit a recharge request
router.post(
  "/recharge-requests",
  requireRole(UserRole.DISTRIBUTOR),
  validateRequest({ body: schemas.createRechargeRequestSchema }),
  c.createRechargeRequest,
);
// GET  /api/finance/recharge-requests         — list recharge requests (scoped by role)
router.get(
  "/recharge-requests",
  validateRequest({ query: schemas.listQuerySchema }),
  c.listRechargeRequests,
);
// POST /api/finance/recharge-requests/:id/approve — SA: approve recharge request
router.post(
  "/recharge-requests/:id/approve",
  requireRole(UserRole.SUPER_ADMIN),
  validateRequest({
    params: schemas.financeIdParamsSchema,
    body: emptyObjectSchema,
  }),
  c.approveRechargeRequest,
);
// POST /api/finance/recharge-requests/:id/reject  — SA: reject recharge request
router.post(
  "/recharge-requests/:id/reject",
  requireRole(UserRole.SUPER_ADMIN),
  validateRequest({
    params: schemas.financeIdParamsSchema,
    body: schemas.rejectRechargeRequestSchema,
  }),
  c.rejectRechargeRequest,
);

module.exports = router;
