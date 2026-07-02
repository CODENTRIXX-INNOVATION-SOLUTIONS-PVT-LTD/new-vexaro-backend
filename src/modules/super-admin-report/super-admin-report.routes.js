'use strict';

const { Router } = require('express');
const { authMiddleware, requireRole } = require('../../middleware/auth.middleware');
const { UserRole } = require('../../constants');
const { wrapController } = require('../../utils/errors');
const superAdminReportController = require('./super-admin-report.controller');

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Note: Super Admin role is applied individually to each route
// This allows the same controller to be used as route aliases in /api/v1/reports

const wrap = wrapController;

// ─── Base Route Registration ─────────────────────────────────────────────────────
// Base route: /api/super-admin-report
// Super Admin role required for all endpoints

// Overview Endpoint
router.get('/overview', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.dashboardSummary));

// Shipment Report Endpoints
router.get('/shipments/trend', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.shipmentTrend));
router.get('/shipments/status', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.shipmentStatus));
router.get('/shipments/summary', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.shipmentSummary));
router.get('/shipments/top-merchants', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.topMerchantsByShipments));
router.get('/shipments/recent', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.recentShipments));
router.get('/shipments/analytics', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.shipmentAnalytics));

// Revenue Report Endpoints
router.get('/revenue/trend', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.revenueTrend));
router.get('/revenue/source', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.revenueSource));
router.get('/revenue/insights', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.revenueInsights));
router.get('/revenue/top-merchants', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.topRevenueMerchants));
router.get('/revenue/payment-methods', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.revenueByPaymentMethod));
router.get('/revenue/transactions', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.recentRevenueTransactions));
router.get('/revenue/summary', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.revenueSummary));

// Merchant Report Endpoints
router.get('/merchants/summary', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.merchantSummary));
router.get('/merchants/insights', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.merchantInsights));
router.get('/merchants/top', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.topMerchants));
router.get('/merchants/categories', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.merchantsByCategory));
router.get('/merchants/recent', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.recentMerchants));
router.get('/merchants/growth', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.merchantGrowth));
router.get('/merchants/category-distribution', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.merchantCategoryDistribution));

// Distributor Report Endpoints
router.get('/distributors/summary', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.distributorSummary));
router.get('/distributors/insights', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.distributorInsights));
router.get('/distributors/top', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.topDistributors));
router.get('/distributors/regional', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.regionalPerformance));
router.get('/distributors/activities', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.distributorActivities));
router.get('/distributors/performance', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.distributorPerformance));
router.get('/distributors/regional-distribution', requireRole(UserRole.SUPER_ADMIN), wrap(superAdminReportController.regionalDistribution));

module.exports = router;
