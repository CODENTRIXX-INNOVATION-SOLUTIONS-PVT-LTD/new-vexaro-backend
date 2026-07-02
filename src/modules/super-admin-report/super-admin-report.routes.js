'use strict';

const { Router } = require('express');
const { authMiddleware, requireRole } = require('../../middleware/auth.middleware');
const { UserRole } = require('../../constants');
const { wrapController } = require('../../utils/errors');
const superAdminReportController = require('./super-admin-report.controller');

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Apply Super Admin role requirement to all routes
router.use(requireRole(UserRole.SUPER_ADMIN));

const wrap = wrapController;

// ─── Base Route Registration ─────────────────────────────────────────────────────
// Base route: /api/super-admin-report

// Overview Endpoint
router.get('/overview', wrap(superAdminReportController.dashboardSummary));

// Shipment Report Endpoints
router.get('/shipments/trend', wrap(superAdminReportController.shipmentTrend));
router.get('/shipments/status', wrap(superAdminReportController.shipmentStatus));
router.get('/shipments/summary', wrap(superAdminReportController.shipmentSummary));
router.get('/shipments/top-merchants', wrap(superAdminReportController.topMerchantsByShipments));
router.get('/shipments/recent', wrap(superAdminReportController.recentShipments));
router.get('/shipments/analytics', wrap(superAdminReportController.shipmentAnalytics));

// Revenue Report Endpoints
router.get('/revenue/trend', wrap(superAdminReportController.revenueTrend));
router.get('/revenue/source', wrap(superAdminReportController.revenueSource));
router.get('/revenue/insights', wrap(superAdminReportController.revenueInsights));
router.get('/revenue/top-merchants', wrap(superAdminReportController.topRevenueMerchants));
router.get('/revenue/payment-methods', wrap(superAdminReportController.revenueByPaymentMethod));
router.get('/revenue/transactions', wrap(superAdminReportController.recentRevenueTransactions));
router.get('/revenue/summary', wrap(superAdminReportController.revenueSummary));

// Merchant Report Endpoints
router.get('/merchants/summary', wrap(superAdminReportController.merchantSummary));
router.get('/merchants/insights', wrap(superAdminReportController.merchantInsights));
router.get('/merchants/top', wrap(superAdminReportController.topMerchants));
router.get('/merchants/categories', wrap(superAdminReportController.merchantsByCategory));
router.get('/merchants/recent', wrap(superAdminReportController.recentMerchants));
router.get('/merchants/growth', wrap(superAdminReportController.merchantGrowth));
router.get('/merchants/category-distribution', wrap(superAdminReportController.merchantCategoryDistribution));

// Distributor Report Endpoints
router.get('/distributors/summary', wrap(superAdminReportController.distributorSummary));
router.get('/distributors/insights', wrap(superAdminReportController.distributorInsights));
router.get('/distributors/top', wrap(superAdminReportController.topDistributors));
router.get('/distributors/regional', wrap(superAdminReportController.regionalPerformance));
router.get('/distributors/activities', wrap(superAdminReportController.distributorActivities));
router.get('/distributors/performance', wrap(superAdminReportController.distributorPerformance));
router.get('/distributors/regional-distribution', wrap(superAdminReportController.regionalDistribution));

module.exports = router;
