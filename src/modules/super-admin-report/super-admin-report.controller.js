'use strict';

const { success } = require('../../utils/response');
const superAdminReportService = require('./super-admin-report.service');

/**
 * Super Admin Report Controller
 * Handles HTTP requests for Super Admin reporting endpoints
 */

const dashboardSummary = async (req, res) => {
  const data = await superAdminReportService.getReportsOverviewService(req.user);
  success(res, 'Dashboard summary retrieved', data);
};

// Shipment Report Endpoints
const shipmentTrend = async (req, res) => {
  const query = req.query;
  const data = await superAdminReportService.getShipmentTrendService(query, req.user);
  success(res, 'Shipment trend retrieved', data);
};

const shipmentStatus = async (req, res) => {
  const data = await superAdminReportService.getShipmentStatusService(req.user);
  success(res, 'Shipment status retrieved', data);
};

const shipmentSummary = async (req, res) => {
  const data = await superAdminReportService.getShipmentSummaryService(req.user);
  success(res, 'Shipment summary retrieved', data);
};

const topMerchantsByShipments = async (req, res) => {
  const query = req.query;
  const data = await superAdminReportService.getTopMerchantsByShipmentsService(query, req.user);
  success(res, 'Top merchants by shipments retrieved', data);
};

const recentShipments = async (req, res) => {
  const query = req.query;
  const data = await superAdminReportService.getRecentShipmentsService(query, req.user);
  success(res, 'Recent shipments retrieved', data);
};

const shipmentAnalytics = async (req, res) => {
  const data = await superAdminReportService.getShipmentAnalyticsService(req.user);
  success(res, 'Shipment analytics retrieved', data);
};

// Revenue Report Endpoints
const revenueTrend = async (req, res) => {
  const query = req.query;
  const data = await superAdminReportService.getRevenueTrendService(query, req.user);
  success(res, 'Revenue trend retrieved', data);
};

const revenueSource = async (req, res) => {
  const data = await superAdminReportService.getRevenueSourceService(req.user);
  success(res, 'Revenue source retrieved', data);
};

const revenueInsights = async (req, res) => {
  const data = await superAdminReportService.getRevenueInsightsService(req.user);
  success(res, 'Revenue insights retrieved', data);
};

const topRevenueMerchants = async (req, res) => {
  const query = req.query;
  const data = await superAdminReportService.getTopRevenueMerchantsService(query, req.user);
  success(res, 'Top revenue merchants retrieved', data);
};

const revenueByPaymentMethod = async (req, res) => {
  const data = await superAdminReportService.getRevenueByPaymentMethodService(req.user);
  success(res, 'Revenue by payment method retrieved', data);
};

const recentRevenueTransactions = async (req, res) => {
  const query = req.query;
  const data = await superAdminReportService.getRecentRevenueTransactionsService(query, req.user);
  success(res, 'Recent revenue transactions retrieved', data);
};

const revenueSummary = async (req, res) => {
  const data = await superAdminReportService.getRevenueSummaryService(req.user);
  success(res, 'Revenue summary retrieved', data);
};

// Merchant Report Endpoints
const merchantSummary = async (req, res) => {
  const data = await superAdminReportService.getMerchantSummaryService(req.user);
  success(res, 'Merchant summary retrieved', data);
};

const merchantInsights = async (req, res) => {
  const data = await superAdminReportService.getMerchantInsightsService(req.user);
  success(res, 'Merchant insights retrieved', data);
};

const topMerchants = async (req, res) => {
  const query = req.query;
  const data = await superAdminReportService.getTopMerchantsService(query, req.user);
  success(res, 'Top merchants retrieved', data);
};

const merchantsByCategory = async (req, res) => {
  const data = await superAdminReportService.getMerchantsByCategoryService(req.user);
  success(res, 'Merchants by category retrieved', data);
};

const recentMerchants = async (req, res) => {
  const query = req.query;
  const data = await superAdminReportService.getRecentMerchantsService(query, req.user);
  success(res, 'Recent merchants retrieved', data);
};

const merchantGrowth = async (req, res) => {
  const query = req.query;
  const data = await superAdminReportService.getMerchantGrowthService(query, req.user);
  success(res, 'Merchant growth retrieved', data);
};

const merchantCategoryDistribution = async (req, res) => {
  const data = await superAdminReportService.getMerchantCategoryDistributionService(req.user);
  success(res, 'Merchant category distribution retrieved', data);
};

// Distributor Report Endpoints
const distributorSummary = async (req, res) => {
  const data = await superAdminReportService.getDistributorSummaryService(req.user);
  success(res, 'Distributor summary retrieved', data);
};

const distributorInsights = async (req, res) => {
  const data = await superAdminReportService.getDistributorInsightsService(req.user);
  success(res, 'Distributor insights retrieved', data);
};

const topDistributors = async (req, res) => {
  const query = req.query;
  const data = await superAdminReportService.getTopDistributorsService(query, req.user);
  success(res, 'Top distributors retrieved', data);
};

const regionalPerformance = async (req, res) => {
  const data = await superAdminReportService.getRegionalPerformanceService(req.user);
  success(res, 'Regional performance retrieved', data);
};

const distributorActivities = async (req, res) => {
  const query = req.query;
  const data = await superAdminReportService.getDistributorActivitiesService(query, req.user);
  success(res, 'Distributor activities retrieved', data);
};

const distributorPerformance = async (req, res) => {
  const data = await superAdminReportService.getDistributorPerformanceService(req.user);
  success(res, 'Distributor performance retrieved', data);
};

const regionalDistribution = async (req, res) => {
  const data = await superAdminReportService.getRegionalDistributionService(req.user);
  success(res, 'Regional distribution retrieved', data);
};

module.exports = {
  dashboardSummary,
  shipmentTrend,
  shipmentStatus,
  shipmentSummary,
  topMerchantsByShipments,
  recentShipments,
  shipmentAnalytics,
  revenueTrend,
  revenueSource,
  revenueInsights,
  topRevenueMerchants,
  revenueByPaymentMethod,
  recentRevenueTransactions,
  revenueSummary,
  merchantSummary,
  merchantInsights,
  topMerchants,
  merchantsByCategory,
  recentMerchants,
  merchantGrowth,
  merchantCategoryDistribution,
  distributorSummary,
  distributorInsights,
  topDistributors,
  regionalPerformance,
  distributorActivities,
  distributorPerformance,
  regionalDistribution,
};
