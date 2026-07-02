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

// ─── Super Admin Report Endpoints (Route Aliases) ───────────────────────────────
// These endpoints provide detailed analytics for Super Admin dashboard
// All require SUPER_ADMIN role

// Overview
router.get('/overview', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.dashboardSummary));

// Shipment Reports
router.get('/shipments/trend', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.shipmentTrend));
router.get('/shipments/status', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.shipmentStatus));
router.get('/shipments/summary', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.shipmentSummary));
router.get('/shipments/top-merchants', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.topMerchantsByShipments));
router.get('/shipments/recent', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.recentShipments));
router.get('/shipments/analytics', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.shipmentAnalytics));

// Revenue Reports
router.get('/revenue/trend', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.revenueTrend));
router.get('/revenue/source', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.revenueSource));
router.get('/revenue/insights', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.revenueInsights));
router.get('/revenue/top-merchants', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.topRevenueMerchants));
router.get('/revenue/payment-methods', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.revenueByPaymentMethod));
router.get('/revenue/transactions', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.recentRevenueTransactions));
router.get('/revenue/summary', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.revenueSummary));

// Merchant Reports
router.get('/merchants/summary', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.merchantSummary));
router.get('/merchants/insights', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.merchantInsights));
router.get('/merchants/top', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.topMerchants));
router.get('/merchants/categories', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.merchantsByCategory));
router.get('/merchants/recent', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.recentMerchants));
router.get('/merchants/growth', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.merchantGrowth));
router.get('/merchants/category-distribution', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.merchantCategoryDistribution));

// Distributor Reports
router.get('/distributors/summary', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.distributorSummary));
router.get('/distributors/insights', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.distributorInsights));
router.get('/distributors/top', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.topDistributors));
router.get('/distributors/regional', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.regionalPerformance));
router.get('/distributors/activities', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.distributorActivities));
router.get('/distributors/performance', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.distributorPerformance));
router.get('/distributors/regional-distribution', requireRole(UserRole.SUPER_ADMIN), wrap(reportController.regionalDistribution));

module.exports = router;
