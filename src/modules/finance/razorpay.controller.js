const { success, created, paginated } = require('../../utils');
const { wrapController } = require('../../utils/errors');
const { getPaginationParams, buildPaginationMeta } = require('../../utils/pagination');
const {
  createRazorpayOrderService,
  verifyPaymentService,
  listPaymentsService,
  getPaymentService,
} = require('./razorpay.service');

const wrap = wrapController;

// ─── POST /api/finance/razorpay/create-order ──────────────────────────────────
exports.createOrder = wrap(async (req, res) => {
  const dto = req.validated.body;
  const result = await createRazorpayOrderService(dto, req.user);
  created(res, 'Razorpay order created', result);
});

// ─── POST /api/finance/razorpay/verify-payment ────────────────────────────────
exports.verifyPayment = wrap(async (req, res) => {
  const dto = req.validated.body;
  const result = await verifyPaymentService(dto, req.user);
  success(res, result.alreadyProcessed ? 'Payment already processed' : 'Payment verified and wallet credited', result);
});

// ─── GET /api/finance/payments ────────────────────────────────────────────────
exports.listPayments = wrap(async (req, res) => {
  const query = req.validated.query;
  const { page, limit } = getPaginationParams(query, 20);
  const { items, total } = await listPaymentsService(query, req.user);
  const meta = buildPaginationMeta(total, page, limit);
  paginated(res, 'Payments retrieved', { payments: items }, meta);
});

// ─── GET /api/finance/payments/:id ────────────────────────────────────────────
exports.getPayment = wrap(async (req, res) => {
  const result = await getPaymentService(req.params.id, req.user);
  success(res, 'Payment retrieved', result);
});
