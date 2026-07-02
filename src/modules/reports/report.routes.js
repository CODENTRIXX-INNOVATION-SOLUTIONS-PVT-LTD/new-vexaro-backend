'use strict';

const { Router } = require('express');
const { authMiddleware, requireRole } = require('../../middleware/auth.middleware');
const { UserRole } = require('../../constants');
const { wrapController } = require('../../utils/errors');
const reportController = require('./report.controller');
const { validateRequest } = require('../../validation');
const schemas = require('../../validation/schemas/reports');

const router = Router();
router.use(authMiddleware);

const wrap = wrapController;

// GET /api/reports/shipments     — shipment volume, status breakdown, delivery rate
router.get('/shipments', validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getShipmentsReport));

// GET /api/reports/revenue       — own wallet credit/debit breakdown
router.get('/revenue', validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getRevenueReport));

// GET /api/reports/merchant-revenue  — SA/Dist: per-merchant shipment + COD stats
router.get('/merchant-revenue',
  requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR),
  validateRequest({ query: schemas.reportQueryDto }),
  wrap(reportController.getMerchantRevenueReport),
);

// GET /api/reports/performance   — delivery times, weekly trend
router.get('/performance', validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getPerformanceReport));

// GET /api/reports/wallet        — available balance and ledger summaries
router.get('/wallet', validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getWalletReport));

// GET /api/reports/cod           — COD collected versus remittance status
router.get('/cod', validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getCODReport));

// GET /api/reports/payment       — Razorpay top-ups success metrics
router.get('/payment', validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getPaymentReport));

// GET /api/reports/export/shipments — Streaming CSV export of shipments (legacy)
router.get('/export/shipments', validateRequest({ query: schemas.exportQueryDto }), wrap(reportController.exportShipments));

// GET /api/reports/export/revenue — Streaming CSV export of transactions (legacy)
router.get('/export/revenue', validateRequest({ query: schemas.exportQueryDto }), wrap(reportController.exportRevenue));

// ─── Async Exports ──────────────────────────────────────────────────────────────

// POST /api/reports/export — Initiate async export job
router.post(
  '/export',
  validateRequest({ body: schemas.createExportJobSchema }),
  wrap(reportController.createExportJob)
);

// GET /api/reports/export/:jobId — Poll job status
router.get(
  '/export/:jobId',
  validateRequest({ params: schemas.exportJobParamsSchema }),
  wrap(reportController.getExportJobStatus)
);

// GET /api/reports/export/download/:filename — Download completed export file
router.get(
  '/export/download/:filename',
  validateRequest({ params: schemas.downloadParamsSchema }),
  wrap(reportController.downloadExportFile)
);

module.exports = router;
