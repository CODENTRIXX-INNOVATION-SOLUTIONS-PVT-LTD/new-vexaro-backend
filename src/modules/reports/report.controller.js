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

// ─── Stub Methods (to be implemented) ─────────────────────────────────────────

const getReportsOverview = async (req, res) => {
  success(res, 'Reports overview', {
    totalShipments: 0,
    totalRevenue: 0,
    totalMerchants: 0,
    totalDistributors: 0,
  });
};

const getDistributorInsights = async (req, res) => {
  success(res, 'Distributor insights', { insights: [] });
};

const getTopDistributors = async (req, res) => {
  success(res, 'Top distributors', { distributors: [] });
};

const getRegionalPerformance = async (req, res) => {
  success(res, 'Regional performance', { regions: [] });
};

const getDistributorActivities = async (req, res) => {
  success(res, 'Distributor activities', { activities: [] });
};

const getDistributorPerformance = async (req, res) => {
  success(res, 'Distributor performance', { performance: [] });
};

const getRegionalDistribution = async (req, res) => {
  success(res, 'Regional distribution', { distribution: [] });
};

const getMerchantSummary = async (req, res) => {
  success(res, 'Merchant summary', {
    totalMerchants: 0,
    activeMerchants: 0,
    newMerchants: 0,
  });
};

const getMerchantInsights = async (req, res) => {
  success(res, 'Merchant insights', { insights: [] });
};

const getTopMerchants = async (req, res) => {
  success(res, 'Top merchants', { merchants: [] });
};

const getMerchantsByCategory = async (req, res) => {
  success(res, 'Merchants by category', { categories: [] });
};

const getRecentMerchants = async (req, res) => {
  success(res, 'Recent merchants', { merchants: [] });
};

const getMerchantGrowth = async (req, res) => {
  success(res, 'Merchant growth', { growth: [] });
};

const getMerchantCategoryDistribution = async (req, res) => {
  success(res, 'Merchant category distribution', { distribution: [] });
};

const getRevenueSummary = async (req, res) => {
  success(res, 'Revenue summary', {
    totalRevenue: 0,
    monthlyRevenue: 0,
    yearlyRevenue: 0,
  });
};

const getRevenueInsights = async (req, res) => {
  success(res, 'Revenue insights', { insights: [] });
};

const getTopRevenueMerchants = async (req, res) => {
  success(res, 'Top revenue merchants', { merchants: [] });
};

const getRevenueByPaymentMethod = async (req, res) => {
  success(res, 'Revenue by payment method', { methods: [] });
};

const getRecentRevenueTransactions = async (req, res) => {
  success(res, 'Recent revenue transactions', { transactions: [] });
};

const getRevenueTrend = async (req, res) => {
  success(res, 'Revenue trend', { trend: [] });
};

const getRevenueSource = async (req, res) => {
  success(res, 'Revenue source', { sources: [] });
};

const getShipmentSummary = async (req, res) => {
  success(res, 'Shipment summary', {
    totalShipments: 0,
    deliveredShipments: 0,
    pendingShipments: 0,
  });
};

const getShipmentTrend = async (req, res) => {
  success(res, 'Shipment trend', { trend: [] });
};

const getShipmentStatus = async (req, res) => {
  success(res, 'Shipment status', { statuses: [] });
};

const getTopMerchantsByShipments = async (req, res) => {
  success(res, 'Top merchants by shipments', { merchants: [] });
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
  // New stub methods
  getReportsOverview,
  getDistributorInsights,
  getTopDistributors,
  getRegionalPerformance,
  getDistributorActivities,
  getDistributorPerformance,
  getRegionalDistribution,
  getMerchantSummary,
  getMerchantInsights,
  getTopMerchants,
  getMerchantsByCategory,
  getRecentMerchants,
  getMerchantGrowth,
  getMerchantCategoryDistribution,
  getRevenueSummary,
  getRevenueInsights,
  getTopRevenueMerchants,
  getRevenueByPaymentMethod,
  getRecentRevenueTransactions,
  getRevenueTrend,
  getRevenueSource,
  getShipmentSummary,
  getShipmentTrend,
  getShipmentStatus,
  getTopMerchantsByShipments,
};
