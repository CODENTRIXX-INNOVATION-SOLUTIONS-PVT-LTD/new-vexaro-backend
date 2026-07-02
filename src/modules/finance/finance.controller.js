const { success, created, paginated } = require('../../utils');
const { wrapController } = require('../../utils/errors');
const { getPaginationParams, buildPaginationMeta } = require('../../utils/pagination');
const {
  getMyWalletService, listWalletsService, topupWalletService, refundWalletService,
  listTransactionsService, listCODService, remitCODService,
  listSettlementsService, createSettlementService, processSettlementService, transferToMerchantService,
  submitRefundRequestService, listRefundRequestsService, processRefundRequestService,
} = require('./finance.service');

const wrap = wrapController;

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

// ─── Admin Stats & Recharge Management ─────────────────────────────────────────

exports.getAdminStats = wrap(async (req, res) => 
  success(res, 'Admin stats retrieved', {
    totalRevenue: 0,
    totalRefunds: 0,
    pendingRecharges: 0,
    totalWalletBalance: 0,
    totalTransactions: 0,
  })
);

exports.listRefunds = wrap(async (req, res) => {
  const query = req.validated.query;
  const { page, limit } = getPaginationParams(query, 20);
  const meta = buildPaginationMeta(0, page, limit);
  paginated(res, 'Refunds retrieved', { refunds: [] }, meta);
});

exports.listRechargeRequests = wrap(async (req, res) => {
  const query = req.validated.query;
  const { page, limit } = getPaginationParams(query, 20);
  const meta = buildPaginationMeta(0, page, limit);
  paginated(res, 'Recharge requests retrieved', { requests: [] }, meta);
});

exports.rechargeDistributorWallet = wrap(async (req, res) => 
  created(res, 'Distributor wallet recharged', { 
    success: true, 
    message: 'Feature not yet implemented' 
  })
);

exports.approveRechargeRequest = wrap(async (req, res) => 
  success(res, 'Recharge request approved', { 
    success: true, 
    message: 'Feature not yet implemented' 
  })
);

exports.rejectRechargeRequest = wrap(async (req, res) => 
  success(res, 'Recharge request rejected', { 
    success: true, 
    message: 'Feature not yet implemented' 
  })
);
