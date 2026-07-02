'use strict';

const { Shipment } = require('../shipments/shipment.model');
const { User } = require('../users/user.model');
const { Wallet, Transaction } = require('../finance/finance.model');
const { COD } = require('../finance/finance.model');
const { UserRole, ShipmentStatus } = require('../../constants');

/**
 * Super Admin Report Service
 * Business logic for Super Admin reporting operations
 */

// Overview Endpoint
const getReportsOverviewService = async (user) => {
  const totalShipments = await Shipment.countDocuments({ deletedAt: null });
  const totalMerchants = await User.countDocuments({ role: UserRole.MERCHANT, deletedAt: null });
  const totalDistributors = await User.countDocuments({ role: UserRole.DISTRIBUTOR, deletedAt: null });
  
  // Calculate total revenue from transactions
  const revenueAggregation = await Transaction.aggregate([
    { $match: { type: { $in: ['CREDIT', 'TOPUP', 'COD_CREDIT'] } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const totalRevenue = revenueAggregation[0]?.total || 0;

  return {
    totalShipments,
    totalRevenue,
    totalMerchants,
    totalDistributors,
  };
};

// Shipment Report Services
const getShipmentTrendService = async (query, user) => {
  const { period, startDate, endDate } = query;
  let matchQuery = { deletedAt: null };

  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  } else if (period) {
    const now = new Date();
    const periodMap = {
      'today': new Date(now.setHours(0, 0, 0, 0)),
      'week': new Date(now.setDate(now.getDate() - 7)),
      'month': new Date(now.setMonth(now.getMonth() - 1)),
      'quarter': new Date(now.setMonth(now.getMonth() - 3)),
      'year': new Date(now.setFullYear(now.getFullYear() - 1)),
    };
    if (periodMap[period]) {
      matchQuery.createdAt = { $gte: periodMap[period] };
    }
  }

  const trendData = await Shipment.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return { trend: trendData };
};

const getShipmentStatusService = async (user) => {
  const statusData = await Shipment.aggregate([
    { $match: { deletedAt: null } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  return { statusBreakdown: statusData };
};

const getShipmentSummaryService = async (user) => {
  const summary = await Shipment.aggregate([
    { $match: { deletedAt: null } },
    {
      $group: {
        _id: null,
        totalShipments: { $sum: 1 },
        totalWeight: { $sum: '$weight' },
        totalCOD: { $sum: { $cond: ['$isCOD', '$codAmount', 0] } },
        avgWeight: { $avg: '$weight' }
      }
    }
  ]);

  return summary[0] || { totalShipments: 0, totalWeight: 0, totalCOD: 0, avgWeight: 0 };
};

const getTopMerchantsByShipmentsService = async (query, user) => {
  const limit = parseInt(query.limit) || 10;
  
  const topMerchants = await Shipment.aggregate([
    { $match: { deletedAt: null } },
    {
      $group: {
        _id: '$merchantId',
        shipmentCount: { $sum: 1 },
        totalRevenue: { $sum: '$merchantCost' }
      }
    },
    { $sort: { shipmentCount: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'merchant'
      }
    },
    { $unwind: '$merchant' },
    {
      $project: {
        merchantId: '$_id',
        merchantName: { $concat: ['$merchant.firstName', ' ', '$merchant.lastName'] },
        shipmentCount: 1,
        totalRevenue: 1
      }
    }
  ]);

  return { topMerchants };
};

const getRecentShipmentsService = async (query, user) => {
  const limit = parseInt(query.limit) || 20;
  
  const recentShipments = await Shipment.find({ deletedAt: null })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('merchantId', 'firstName lastName companyName')
    .populate('distributorId', 'firstName lastName companyName')
    .lean();

  return { recentShipments };
};

const getShipmentAnalyticsService = async (user) => {
  const analytics = await Shipment.aggregate([
    { $match: { deletedAt: null } },
    {
      $group: {
        _id: null,
        deliveredCount: { $sum: { $cond: [{ $eq: ['$status', ShipmentStatus.DELIVERED] }, 1, 0] } },
        rtoCount: { $sum: { $cond: [{ $eq: ['$status', ShipmentStatus.RTO] }, 1, 0] } },
        cancelledCount: { $sum: { $cond: [{ $eq: ['$status', ShipmentStatus.CANCELLED] }, 1, 0] } },
        totalShipments: { $sum: 1 }
      }
    }
  ]);

  const data = analytics[0] || { deliveredCount: 0, rtoCount: 0, cancelledCount: 0, totalShipments: 0 };
  data.deliveryRate = data.totalShipments > 0 ? ((data.deliveredCount / data.totalShipments) * 100).toFixed(2) : 0;
  data.rtoRate = data.totalShipments > 0 ? ((data.rtoCount / data.totalShipments) * 100).toFixed(2) : 0;

  return { analytics: data };
};

// Revenue Report Services
const getRevenueTrendService = async (query, user) => {
  const { period, startDate, endDate } = query;
  let matchQuery = {};

  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  } else if (period) {
    const now = new Date();
    const periodMap = {
      'today': new Date(now.setHours(0, 0, 0, 0)),
      'week': new Date(now.setDate(now.getDate() - 7)),
      'month': new Date(now.setMonth(now.getMonth() - 1)),
      'quarter': new Date(now.setMonth(now.getMonth() - 3)),
      'year': new Date(now.setFullYear(now.getFullYear() - 1)),
    };
    if (periodMap[period]) {
      matchQuery.createdAt = { $gte: periodMap[period] };
    }
  }

  const trendData = await Transaction.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        totalRevenue: { $sum: '$amount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return { trend: trendData };
};

const getRevenueSourceService = async (user) => {
  const sourceData = await Transaction.aggregate([
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  return { revenueSources: sourceData };
};

const getRevenueInsightsService = async (user) => {
  const insights = await Transaction.aggregate([
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        totalTransactions: { $sum: 1 },
        avgTransaction: { $avg: '$amount' }
      }
    }
  ]);

  return insights[0] || { totalRevenue: 0, totalTransactions: 0, avgTransaction: 0 };
};

const getTopRevenueMerchantsService = async (query, user) => {
  const limit = parseInt(query.limit) || 10;
  
  const topMerchants = await Transaction.aggregate([
    { $match: { type: { $in: ['CREDIT', 'TOPUP', 'COD_CREDIT'] } } },
    {
      $group: {
        _id: '$userId',
        totalRevenue: { $sum: '$amount' },
        transactionCount: { $sum: 1 }
      }
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        userId: '$_id',
        userName: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
        totalRevenue: 1,
        transactionCount: 1
      }
    }
  ]);

  return { topRevenueMerchants: topMerchants };
};

const getRevenueByPaymentMethodService = async (user) => {
  // This would need payment method data - placeholder for now
  return { paymentMethods: [] };
};

const getRecentRevenueTransactionsService = async (query, user) => {
  const limit = parseInt(query.limit) || 20;
  
  const transactions = await Transaction.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'firstName lastName email')
    .lean();

  return { transactions };
};

const getRevenueSummaryService = async (user) => {
  const summary = await Transaction.aggregate([
    {
      $group: {
        _id: null,
        totalCredits: { $sum: { $cond: [{ $eq: ['$type', 'CREDIT'] }, '$amount', 0] } },
        totalDebits: { $sum: { $cond: [{ $eq: ['$type', 'DEBIT'] }, '$amount', 0] } },
        totalTopups: { $sum: { $cond: [{ $eq: ['$type', 'TOPUP'] }, '$amount', 0] } },
        totalCOD: { $sum: { $cond: [{ $eq: ['$type', 'COD_CREDIT'] }, '$amount', 0] } }
      }
    }
  ]);

  return summary[0] || { totalCredits: 0, totalDebits: 0, totalTopups: 0, totalCOD: 0 };
};

// Merchant Report Services
const getMerchantSummaryService = async (user) => {
  const summary = await User.aggregate([
    { $match: { role: UserRole.MERCHANT, deletedAt: null } },
    {
      $group: {
        _id: null,
        totalMerchants: { $sum: 1 },
        activeMerchants: { $sum: { $cond: ['$isActive', 1, 0] } }
      }
    }
  ]);

  return summary[0] || { totalMerchants: 0, activeMerchants: 0 };
};

const getMerchantInsightsService = async (user) => {
  const merchantShipments = await Shipment.aggregate([
    { $match: { deletedAt: null } },
    {
      $group: {
        _id: '$merchantId',
        shipmentCount: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        avgShipmentsPerMerchant: { $avg: '$shipmentCount' },
        totalMerchants: { $sum: 1 }
      }
    }
  ]);

  return merchantShipments[0] || { avgShipmentsPerMerchant: 0, totalMerchants: 0 };
};

const getTopMerchantsService = async (query, user) => {
  const limit = parseInt(query.limit) || 10;
  
  const topMerchants = await User.find({ role: UserRole.MERCHANT, deletedAt: null })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return { topMerchants };
};

const getMerchantsByCategoryService = async (user) => {
  // Placeholder - would need category data in user model
  return { categories: [] };
};

const getRecentMerchantsService = async (query, user) => {
  const limit = parseInt(query.limit) || 20;
  
  const recentMerchants = await User.find({ role: UserRole.MERCHANT, deletedAt: null })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return { recentMerchants };
};

const getMerchantGrowthService = async (query, user) => {
  const { period } = query;
  let matchQuery = { role: UserRole.MERCHANT, deletedAt: null };

  if (period) {
    const now = new Date();
    const periodMap = {
      'week': new Date(now.setDate(now.getDate() - 7)),
      'month': new Date(now.setMonth(now.getMonth() - 1)),
      'quarter': new Date(now.setMonth(now.getMonth() - 3)),
      'year': new Date(now.setFullYear(now.getFullYear() - 1)),
    };
    if (periodMap[period]) {
      matchQuery.createdAt = { $gte: periodMap[period] };
    }
  }

  const growthData = await User.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return { growth: growthData };
};

const getMerchantCategoryDistributionService = async (user) => {
  // Placeholder - would need category data
  return { distribution: [] };
};

// Distributor Report Services
const getDistributorSummaryService = async (user) => {
  const summary = await User.aggregate([
    { $match: { role: UserRole.DISTRIBUTOR, deletedAt: null } },
    {
      $group: {
        _id: null,
        totalDistributors: { $sum: 1 },
        activeDistributors: { $sum: { $cond: ['$isActive', 1, 0] } }
      }
    }
  ]);

  return summary[0] || { totalDistributors: 0, activeDistributors: 0 };
};

const getDistributorInsightsService = async (user) => {
  const distributorMerchants = await User.aggregate([
    { $match: { role: UserRole.MERCHANT, deletedAt: null, invitedBy: { $ne: null } } },
    {
      $group: {
        _id: '$invitedBy',
        merchantCount: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        avgMerchantsPerDistributor: { $avg: '$merchantCount' },
        totalDistributors: { $sum: 1 }
      }
    }
  ]);

  return distributorMerchants[0] || { avgMerchantsPerDistributor: 0, totalDistributors: 0 };
};

const getTopDistributorsService = async (query, user) => {
  const limit = parseInt(query.limit) || 10;
  
  const topDistributors = await User.find({ role: UserRole.DISTRIBUTOR, deletedAt: null })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return { topDistributors };
};

const getRegionalPerformanceService = async (user) => {
  // Placeholder - would need region/state data
  return { regionalPerformance: [] };
};

const getDistributorActivitiesService = async (query, user) => {
  const limit = parseInt(query.limit) || 20;
  
  // Get recent activities from shipments
  const activities = await Shipment.aggregate([
    { $match: { deletedAt: null, distributorId: { $ne: null } } },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'distributorId',
        foreignField: '_id',
        as: 'distributor'
      }
    },
    { $unwind: '$distributor' },
    {
      $project: {
        distributorId: '$distributorId',
        distributorName: { $concat: ['$distributor.firstName', ' ', '$distributor.lastName'] },
        activity: 'Shipment Created',
        timestamp: '$createdAt',
        awb: '$awb'
      }
    }
  ]);

  return { activities };
};

const getDistributorPerformanceService = async (user) => {
  const performance = await Shipment.aggregate([
    { $match: { deletedAt: null, distributorId: { $ne: null } } },
    {
      $group: {
        _id: '$distributorId',
        totalShipments: { $sum: 1 },
        deliveredShipments: { $sum: { $cond: [{ $eq: ['$status', ShipmentStatus.DELIVERED] }, 1, 0] } }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'distributor'
      }
    },
    { $unwind: '$distributor' },
    {
      $project: {
        distributorId: '$_id',
        distributorName: { $concat: ['$distributor.firstName', ' ', '$distributor.lastName'] },
        totalShipments: 1,
        deliveredShipments: 1,
        deliveryRate: { $cond: [{ $eq: ['$totalShipments', 0] }, 0, { $multiply: [{ $divide: ['$deliveredShipments', '$totalShipments'] }, 100] }] }
      }
    }
  ]);

  return { performance };
};

const getRegionalDistributionService = async (user) => {
  // Get distribution by destination city
  const distribution = await Shipment.aggregate([
    { $match: { deletedAt: null } },
    {
      $group: {
        _id: '$destination.city',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]);

  return { regionalDistribution: distribution };
};

module.exports = {
  getReportsOverviewService,
  getShipmentTrendService,
  getShipmentStatusService,
  getShipmentSummaryService,
  getTopMerchantsByShipmentsService,
  getRecentShipmentsService,
  getShipmentAnalyticsService,
  getRevenueTrendService,
  getRevenueSourceService,
  getRevenueInsightsService,
  getTopRevenueMerchantsService,
  getRevenueByPaymentMethodService,
  getRecentRevenueTransactionsService,
  getRevenueSummaryService,
  getMerchantSummaryService,
  getMerchantInsightsService,
  getTopMerchantsService,
  getMerchantsByCategoryService,
  getRecentMerchantsService,
  getMerchantGrowthService,
  getMerchantCategoryDistributionService,
  getDistributorSummaryService,
  getDistributorInsightsService,
  getTopDistributorsService,
  getRegionalPerformanceService,
  getDistributorActivitiesService,
  getDistributorPerformanceService,
  getRegionalDistributionService,
};
