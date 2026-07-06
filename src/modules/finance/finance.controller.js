const { success, created, paginated } = require('../../utils');
const { wrapController } = require('../../utils/errors');
const { getPaginationParams, buildPaginationMeta } = require('../../utils/pagination');
const {
  getMyWalletService, listWalletsService, topupWalletService, refundWalletService,
  listTransactionsService, listCODService, remitCODService,
  listSettlementsService, createSettlementService, processSettlementService, transferToMerchantService,
  submitRefundRequestService, listRefundRequestsService, processRefundRequestService,
  getAdminStatsService, rechargeDistributorWalletService, listCommissionService, listRefundsService,
  listRechargeRequestsService, createRechargeRequestService, approveRechargeRequestService, rejectRechargeRequestService,
} = require('./finance.service');

const {
  createMerchantRechargeRequestService,
  listMerchantRechargeRequestsService,
  approveMerchantRechargeRequestService,
  rejectMerchantRechargeRequestService,
} = require('./services/merchant-recharge-request.service');

const wrap = wrapController;

// ─── Merchant Recharge Requests ─────────────────────────────────────────────

exports.createMerchantRechargeRequest = wrap(async (req, res) =>
  created(res, 'Top-up request submitted successfully', await createMerchantRechargeRequestService(req.validated.body, req.user)),
);

exports.listMerchantRechargeRequests = wrap(async (req, res) => {
  const query = req.validated.query;
  const { page, limit } = getPaginationParams(query, 20);
  const { items, total } = await listMerchantRechargeRequestsService(query, req.user);
  const meta = buildPaginationMeta(total, page, limit);
  paginated(res, 'Merchant recharge requests retrieved', { requests: items }, meta);
});

exports.approveMerchantRechargeRequest = wrap(async (req, res) =>
  success(res, 'Request approved and wallet credited', await approveMerchantRechargeRequestService(req.validated.params.id, req.user)),
);

exports.rejectMerchantRechargeRequest = wrap(async (req, res) =>
  success(res, 'Request rejected', await rejectMerchantRechargeRequestService(req.validated.params.id, req.validated.body, req.user)),
);

// Wallet
exports.getMyWallet     = wrap(async (req, res) => success(res, 'Wallet retrieved', await getMyWalletService(req.user)));

exports.listWallets     = wrap(async (req, res) => {
  const query = req.validated.query;
  const { page, limit } = getPaginationParams(query, 20);
  const { items, total } = await listWalletsService(query, req.user);
  const meta = buildPaginationMeta(total, page, limit);
  paginated(res, 'Wallets retrieved', { wallets: items }, meta);
});

exports.topupWallet = wrap(async (req, res) => created(res, 'Wallet topped up successfully', await topupWalletService(req.validated.body, req.user)));

// Transactions
exports.listTransactions = wrap(async (req, res) => {
  const query = req.validated.query;
  const { page, limit } = getPaginationParams(query, 20);
  const { items, total } = await listTransactionsService(query, req.user);
  const meta = buildPaginationMeta(total, page, limit);
  paginated(res, 'Transactions retrieved', { transactions: items }, meta);
});

// COD
exports.listCOD  = wrap(async (req, res) => {
  const query = req.validated.query;
  const { page, limit } = getPaginationParams(query, 20);
  const { items, total } = await listCODService(query, req.user);
  const meta = buildPaginationMeta(total, page, limit);
  paginated(res, 'COD records retrieved', { cods: items }, meta);
});

exports.remitCOD = wrap(async (req, res) => success(res, 'COD remitted successfully', await remitCODService(req.params.id, req.validated.body, req.user)));

// Settlements
exports.listSettlements    = wrap(async (req, res) => {
  const query = req.validated.query;
  const { page, limit } = getPaginationParams(query, 20);
  const { items, total } = await listSettlementsService(query, req.user);
  const meta = buildPaginationMeta(total, page, limit);
  paginated(res, 'Settlements retrieved', { settlements: items }, meta);
});

exports.createSettlement = wrap(async (req, res) => created(res, 'Settlement created', await createSettlementService(req.validated.body, req.user)));

exports.processSettlement = wrap(async (req, res) => success(res, 'Settlement processed', await processSettlementService(req.params.id, req.validated.body, req.user)));

// Transfer to Merchant
exports.transferToMerchant = wrap(async (req, res) => success(res, 'Funds transferred successfully', await transferToMerchantService(req.validated.body, req.user)));

// Refund Wallet (manual — SA only)
exports.refundWallet = wrap(async (req, res) => created(res, 'Refund applied successfully', await refundWalletService(req.validated.body, req.user)));

// ─── Refund Requests ────────────────────────────────────────────────────────────

exports.submitRefundRequest = wrap(async (req, res) =>
  created(res, 'Refund request submitted successfully', await submitRefundRequestService(req.validated.body, req.user)),
);

exports.listRefundRequests = wrap(async (req, res) => {
  const query = req.validated.query;
  const { page, limit } = getPaginationParams(query, 20);
  const { items, total } = await listRefundRequestsService(query, req.user);
  const meta = buildPaginationMeta(total, page, limit);
  paginated(res, 'Refund requests retrieved', { refundRequests: items }, meta);
});

exports.processRefundRequest = wrap(async (req, res) =>
  success(res, 'Refund request processed successfully', await processRefundRequestService(req.validated.params.id, req.validated.body, req.user)),
);

// ─── Admin Stats ──────────────────────────────────────────────────────────────
exports.getAdminStats = wrap(async (req, res) => success(res, 'Admin stats retrieved', await getAdminStatsService(req.user)));

// ─── Distributor Wallet Recharge (Admin Manual) ────────────────────────────────
exports.rechargeDistributorWallet = wrap(async (req, res) => created(res, 'Distributor wallet recharged successfully', await rechargeDistributorWalletService(req.validated.body, req.user)));

// ─── Commission ─────────────────────────────────────────────────────────────────
exports.listCommission = wrap(async (req, res) => {
  const query = req.validated.query;
  const { page, limit } = getPaginationParams(query, 20);
  const { items, total } = await listCommissionService(query, req.user);
  const meta = buildPaginationMeta(total, page, limit);
  paginated(res, 'Commission retrieved', { commissions: items }, meta);
});

// ─── Refunds ────────────────────────────────────────────────────────────────────
exports.listRefunds = wrap(async (req, res) => {
  const query = req.validated.query;
  const { page, limit } = getPaginationParams(query, 20);
  const { items, total } = await listRefundsService(query, req.user);
  const meta = buildPaginationMeta(total, page, limit);
  paginated(res, 'Refunds retrieved', { refunds: items }, meta);
});

// ─── Recharge Requests ─────────────────────────────────────────────────────────
exports.listRechargeRequests = wrap(async (req, res) => {
  const query = req.validated.query;
  const { page, limit } = getPaginationParams(query, 20);
  const { items, total } = await listRechargeRequestsService(query, req.user);
  const meta = buildPaginationMeta(total, page, limit);
  paginated(res, 'Recharge requests retrieved', { rechargeRequests: items }, meta);
});

exports.createRechargeRequest = wrap(async (req, res) =>
  created(res, 'Recharge request submitted successfully', await createRechargeRequestService(req.validated.body, req.user)),
);

exports.approveRechargeRequest = wrap(async (req, res) =>
  success(res, 'Recharge request approved successfully', await approveRechargeRequestService(req.validated.params.id, req.user)),
);

exports.rejectRechargeRequest = wrap(async (req, res) =>
  success(res, 'Recharge request rejected successfully', await rejectRechargeRequestService(req.validated.params.id, req.validated.body, req.user)),
);
