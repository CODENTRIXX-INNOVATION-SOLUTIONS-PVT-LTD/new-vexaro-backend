'use strict';

const reportService = require('./report.service');
const reportRepository = require('./report.repository');
const { success } = require('../../utils/response');
const { UserRole } = require('../../constants');

/**
 * Report Controller
 * Handles HTTP requests and CSV streaming exports.
 */

const getShipmentsReport = async (req, res) => {
  const query = req.validated.query;
  const data = await reportService.shipmentReportService(query, req.user);
  success(res, 'Shipment report', data);
};

const getRevenueReport = async (req, res) => {
  const query = req.validated.query;
  const data = await reportService.revenueReportService(query, req.user);
  success(res, 'Revenue report', data);
};

const getMerchantRevenueReport = async (req, res) => {
  const query = req.validated.query;
  const data = await reportService.merchantRevenueReportService(query, req.user);
  success(res, 'Merchant revenue report', data);
};

const getPerformanceReport = async (req, res) => {
  const query = req.validated.query;
  const data = await reportService.performanceReportService(query, req.user);
  success(res, 'Performance report', data);
};

const getWalletReport = async (req, res) => {
  const query = req.validated.query;
  const data = await reportService.walletReportService(query, req.user);
  success(res, 'Wallet report', data);
};

const getCODReport = async (req, res) => {
  const query = req.validated.query;
  const data = await reportService.codReportService(query, req.user);
  success(res, 'COD report', data);
};

const getPaymentReport = async (req, res) => {
  const query = req.validated.query;
  const data = await reportService.paymentReportService(query, req.user);
  success(res, 'Payment report', data);
};

// Scoped filter builder for streaming CSV exports
const buildExportFilter = (caller, query = {}) => {
  const f = { deletedAt: null };
  if (caller.role === UserRole.MERCHANT)     f.merchantId    = caller.userId;
  else if (caller.role === UserRole.DISTRIBUTOR) f.distributorId = caller.userId;
  else if (caller.role === UserRole.WAREHOUSE)   f.warehouseId   = caller.userId;

  if (caller.role === UserRole.SUPER_ADMIN) {
    if (query.merchantId)    f.merchantId    = query.merchantId;
    if (query.distributorId) f.distributorId = query.distributorId;
    if (query.warehouseId)   f.warehouseId   = query.warehouseId;
  }

  if (query.dateFrom || query.dateTo) {
    f.createdAt = {};
    if (query.dateFrom) f.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo)   f.createdAt.$lte = new Date(query.dateTo);
  }
  return f;
};

const exportShipments = async (req, res) => {
  const query = req.validated.query;
  const now      = new Date();
  let dateFrom   = query.dateFrom ? new Date(query.dateFrom) : null;
  let dateTo     = query.dateTo   ? new Date(query.dateTo)   : null;

  // Default to last 90 days when no dates are provided
  if (!dateFrom && !dateTo) {
    dateFrom = new Date(now);
    dateFrom.setDate(dateFrom.getDate() - 90);
    dateTo = now;
  } else if (!dateTo) {
    dateTo = now;
  } else if (!dateFrom) {
    dateFrom = new Date(dateTo);
    dateFrom.setDate(dateFrom.getDate() - 90);
  }

  // Enforce 1-year maximum range
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  if (dateFrom < oneYearAgo) {
    const err = new Error('Export date range cannot exceed 1 year');
    err.statusCode = 400;
    throw err;
  }

  const filter = buildExportFilter(req.user, { ...query, dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() });

  const fromStr = dateFrom.toISOString().slice(0, 10);
  const toStr   = dateTo.toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=shipments-${fromStr}-to-${toStr}.csv`);
  res.write('AWB,Status,MerchantID,DistributorID,WarehouseID,Weight,DeclaredValue,isCOD,CODAmount,OriginCity,DestinationCity,CreatedAt\n');

  const cursor = reportRepository.shipmentCursor(filter);
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const originCity = doc.origin?.city ? doc.origin.city.replace(/"/g, '""') : '';
    const destCity = doc.destination?.city ? doc.destination.city.replace(/"/g, '""') : '';
    const line = `"${doc.awb}","${doc.status}","${doc.merchantId}","${doc.distributorId || ''}","${doc.warehouseId || ''}",${doc.weight},${doc.declaredValue || 0},${doc.isCOD},${doc.codAmount || 0},"${originCity}","${destCity}","${doc.createdAt.toISOString()}"\n`;
    res.write(line);
  }
  res.end();
};

const exportRevenue = async (req, res) => {
  const query = req.validated.query;
  const now      = new Date();
  let dateFrom   = query.dateFrom ? new Date(query.dateFrom) : null;
  let dateTo     = query.dateTo   ? new Date(query.dateTo)   : null;

  // Default to last 90 days when no dates are provided
  if (!dateFrom && !dateTo) {
    dateFrom = new Date(now);
    dateFrom.setDate(dateFrom.getDate() - 90);
    dateTo = now;
  } else if (!dateTo) {
    dateTo = now;
  } else if (!dateFrom) {
    dateFrom = new Date(dateTo);
    dateFrom.setDate(dateFrom.getDate() - 90);
  }

  // Enforce 1-year maximum range
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  if (dateFrom < oneYearAgo) {
    const err = new Error('Export date range cannot exceed 1 year');
    err.statusCode = 400;
    throw err;
  }

  const userFilter = { userId: req.user.userId };
  if (req.user.role === UserRole.SUPER_ADMIN) {
    if (query.userId) userFilter.userId = query.userId;
  }

  const dateFilter = {
    createdAt: {
      $gte: dateFrom,
      $lte: dateTo,
    },
  };

  const filter = { ...userFilter, ...dateFilter };

  const fromStr = dateFrom.toISOString().slice(0, 10);
  const toStr   = dateTo.toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=revenue-${fromStr}-to-${toStr}.csv`);
  res.write('TransactionID,WalletID,UserID,Type,Amount,BalanceBefore,BalanceAfter,Reference,PerformedBy,CreatedAt\n');

  const cursor = reportRepository.transactionCursor(filter);
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const line = `"${doc._id}","${doc.walletId}","${doc.userId}","${doc.type}",${doc.amount},${doc.balanceBefore},${doc.balanceAfter},"${doc.reference || ''}","${doc.performedBy || ''}","${doc.createdAt.toISOString()}"\n`;
    res.write(line);
  }
  res.end();
};

const exportService = require('./export.service');
const path = require('path');
const fs = require('fs');

const createExportJob = async (req, res) => {
  const job = await exportService.createExportJobService(req.validated.body, req.user);
  res.status(202).json({
    success: true,
    message: 'Export job queued successfully.',
    data: {
      jobId: job.jobId,
      status: job.status,
    },
  });
};

const getExportJobStatus = async (req, res) => {
  const job = await exportService.getExportJobStatusService(req.params.jobId, req.user);
  success(res, 'Export job status retrieved.', job);
};

const downloadExportFile = async (req, res) => {
  const { filename } = req.params;
  const sanitized = path.basename(filename);
  const filePath = path.join(process.cwd(), 'exports', sanitized);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: 'Export file not found or expired.',
    });
  }

  res.download(filePath);
};

// ─── Super Admin Report Endpoints (Route Aliases) ───────────────────────────────

const dashboardSummary = async (req, res) => {
  const data = await reportService.getReportsOverviewService(req.user);
  success(res, 'Dashboard summary retrieved', data);
};

// Shipment Report Endpoints
const shipmentTrend = async (req, res) => {
  const query = req.query;
  const data = await reportService.getShipmentTrendService(query, req.user);
  success(res, 'Shipment trend retrieved', data);
};

const shipmentStatus = async (req, res) => {
  const data = await reportService.getShipmentStatusService(req.user);
  success(res, 'Shipment status retrieved', data);
};

const shipmentSummary = async (req, res) => {
  const data = await reportService.getShipmentSummaryService(req.user);
  success(res, 'Shipment summary retrieved', data);
};

const topMerchantsByShipments = async (req, res) => {
  const query = req.query;
  const data = await reportService.getTopMerchantsByShipmentsService(query, req.user);
  success(res, 'Top merchants by shipments retrieved', data);
};

const recentShipments = async (req, res) => {
  const query = req.query;
  const data = await reportService.getRecentShipmentsService(query, req.user);
  success(res, 'Recent shipments retrieved', data);
};

const shipmentAnalytics = async (req, res) => {
  const data = await reportService.getShipmentAnalyticsService(req.user);
  success(res, 'Shipment analytics retrieved', data);
};

// Revenue Report Endpoints
const revenueTrend = async (req, res) => {
  const query = req.query;
  const data = await reportService.getRevenueTrendService(query, req.user);
  success(res, 'Revenue trend retrieved', data);
};

const revenueSource = async (req, res) => {
  const data = await reportService.getRevenueSourceService(req.user);
  success(res, 'Revenue source retrieved', data);
};

const revenueInsights = async (req, res) => {
  const data = await reportService.getRevenueInsightsService(req.user);
  success(res, 'Revenue insights retrieved', data);
};

const topRevenueMerchants = async (req, res) => {
  const query = req.query;
  const data = await reportService.getTopRevenueMerchantsService(query, req.user);
  success(res, 'Top revenue merchants retrieved', data);
};

const revenueByPaymentMethod = async (req, res) => {
  const data = await reportService.getRevenueByPaymentMethodService(req.user);
  success(res, 'Revenue by payment method retrieved', data);
};

const recentRevenueTransactions = async (req, res) => {
  const query = req.query;
  const data = await reportService.getRecentRevenueTransactionsService(query, req.user);
  success(res, 'Recent revenue transactions retrieved', data);
};

const revenueSummary = async (req, res) => {
  const data = await reportService.getRevenueSummaryService(req.user);
  success(res, 'Revenue summary retrieved', data);
};

// Merchant Report Endpoints
const merchantSummary = async (req, res) => {
  const data = await reportService.getMerchantSummaryService(req.user);
  success(res, 'Merchant summary retrieved', data);
};

const merchantInsights = async (req, res) => {
  const data = await reportService.getMerchantInsightsService(req.user);
  success(res, 'Merchant insights retrieved', data);
};

const topMerchants = async (req, res) => {
  const query = req.query;
  const data = await reportService.getTopMerchantsService(query, req.user);
  success(res, 'Top merchants retrieved', data);
};

const merchantsByCategory = async (req, res) => {
  const data = await reportService.getMerchantsByCategoryService(req.user);
  success(res, 'Merchants by category retrieved', data);
};

const recentMerchants = async (req, res) => {
  const query = req.query;
  const data = await reportService.getRecentMerchantsService(query, req.user);
  success(res, 'Recent merchants retrieved', data);
};

const merchantGrowth = async (req, res) => {
  const query = req.query;
  const data = await reportService.getMerchantGrowthService(query, req.user);
  success(res, 'Merchant growth retrieved', data);
};

const merchantCategoryDistribution = async (req, res) => {
  const data = await reportService.getMerchantCategoryDistributionService(req.user);
  success(res, 'Merchant category distribution retrieved', data);
};

// Distributor Report Endpoints
const distributorSummary = async (req, res) => {
  const data = await reportService.getDistributorSummaryService(req.user);
  success(res, 'Distributor summary retrieved', data);
};

const distributorInsights = async (req, res) => {
  const data = await reportService.getDistributorInsightsService(req.user);
  success(res, 'Distributor insights retrieved', data);
};

const topDistributors = async (req, res) => {
  const query = req.query;
  const data = await reportService.getTopDistributorsService(query, req.user);
  success(res, 'Top distributors retrieved', data);
};

const regionalPerformance = async (req, res) => {
  const data = await reportService.getRegionalPerformanceService(req.user);
  success(res, 'Regional performance retrieved', data);
};

const distributorActivities = async (req, res) => {
  const query = req.query;
  const data = await reportService.getDistributorActivitiesService(query, req.user);
  success(res, 'Distributor activities retrieved', data);
};

const distributorPerformance = async (req, res) => {
  const data = await reportService.getDistributorPerformanceService(req.user);
  success(res, 'Distributor performance retrieved', data);
};

const regionalDistribution = async (req, res) => {
  const data = await reportService.getRegionalDistributionService(req.user);
  success(res, 'Regional distribution retrieved', data);
};

module.exports = {
  getShipmentsReport,
  getRevenueReport,
  getMerchantRevenueReport,
  getPerformanceReport,
  getWalletReport,
  getCODReport,
  getPaymentReport,
  exportShipments,
  exportRevenue,
  createExportJob,
  getExportJobStatus,
  downloadExportFile,
  // Super Admin Report Endpoints
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
