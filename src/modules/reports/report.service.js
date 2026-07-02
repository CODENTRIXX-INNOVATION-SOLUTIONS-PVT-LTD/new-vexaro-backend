'use strict';

const { UserRole, ShipmentStatus } = require('../../constants');
const { remember, TTL, KEYS } = require('../../utils/cache');
const crypto = require('crypto');

const reportRepository = require('./report.repository');

// ── Stable hash of query params for cache key (MD5 first 8 chars is plenty) ──
const hashQuery = (query) =>
  crypto.createHash('md5').update(JSON.stringify(query)).digest('hex').slice(0, 8);

// ─── Scope filter builder (reused across all report types) ────────────────────
const buildScope = (caller, query = {}) => {
  const f = { deletedAt: null };
  if (caller.role === UserRole.MERCHANT)     f.merchantId    = caller.userId;
  else if (caller.role === UserRole.DISTRIBUTOR) f.distributorId = caller.userId;
  else if (caller.role === UserRole.WAREHOUSE)   f.warehouseId   = caller.userId;

  if (caller.role === UserRole.SUPER_ADMIN) {
    if (query.merchantId)    f.merchantId    = query.merchantId;
    if (query.distributorId) f.distributorId = query.distributorId;
  }

  if (query.dateFrom || query.dateTo) {
    f.createdAt = {};
    if (query.dateFrom) f.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo)   f.createdAt.$lte = new Date(query.dateTo);
  }
  return f;
};

// ─── Shipment Report ──────────────────────────────────────────────────────────
// GET /api/reports/shipments
const shipmentReportService = async (query, caller) => {
  const cacheKey = KEYS.report('shipments', caller.userId, hashQuery(query));
  return remember(cacheKey, TTL.REPORT, async () => {
    const filter = buildScope(caller, query);

    const [totals, byStatus, byService, dailyVolume, dailyStatusTrends] = await Promise.all([
      // Overall totals
      reportRepository.aggregateShipments([
        { $match: filter },
        { $group: {
          _id:          null,
          totalCount:   { $sum: 1 },
          totalWeight:  { $sum: '$weight' },
          totalCOD:     { $sum: { $cond: ['$isCOD', '$codAmount', 0] } },
          totalDeclared:{ $sum: '$declaredValue' },
          totalRevenue: { $sum: '$merchantCost' },
          vexaroProfit: { $sum: '$vexaroProfit' },
          distributorProfit: { $sum: '$distributorProfit' },
          codCollected: { $sum: '$codCollected' },
          codPayouts: { $sum: { $cond: [{ $eq: ['$codStatus', 'REMITTED'] }, '$codAmount', 0] } },
        }},
      ]),

      // By status
      reportRepository.aggregateShipments([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
      ]),

      // By service type
      reportRepository.aggregateShipments([
        { $match: filter },
        { $group: { _id: '$serviceType', count: { $sum: 1 } } },
      ]),

      // Daily volume (last 30 days)
      reportRepository.aggregateShipments([
        { $match: { ...filter, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),

      // Daily status trends (last 7 days) - for line chart
      reportRepository.aggregateShipments([
        { $match: { ...filter, createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        { $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            status: '$status'
          },
          count: { $sum: 1 }
        }},
        { $sort: { '_id.date': 1 } },
      ]),
    ]);

    const statusMap = byStatus.reduce((a, s) => { a[s._id] = s.count; return a; }, {});
    const deliveryRate = totals[0]?.totalCount
      ? (((statusMap[ShipmentStatus.DELIVERED] || 0) / totals[0].totalCount) * 100).toFixed(2)
      : '0.00';

    return {
      summary: {
        ...(totals[0] || { totalCount: 0, totalWeight: 0, totalCOD: 0, totalDeclared: 0, totalRevenue: 0, vexaroProfit: 0, distributorProfit: 0, codCollected: 0, codPayouts: 0 }),
        deliveryRate: `${deliveryRate}%`,
      },
      byStatus: statusMap,
      byService: byService.reduce((a, s) => { a[s._id] = s.count; return a; }, {}),
      dailyVolume,
      dailyStatusTrends,
    };
  }); // end remember
};

// ─── Revenue Report ───────────────────────────────────────────────────────────
// GET /api/reports/revenue
const revenueReportService = async (query, caller) => {
  const cacheKey = KEYS.report('revenue', caller.userId, hashQuery(query));
  return remember(cacheKey, TTL.REPORT, async () => {
    const userFilter = { userId: caller.userId };
    if (caller.role === UserRole.SUPER_ADMIN && query.userId) userFilter.userId = query.userId;

    const dateFilter = {};
    if (query.dateFrom || query.dateTo) {
      dateFilter.createdAt = {};
      if (query.dateFrom) dateFilter.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo)   dateFilter.createdAt.$lte = new Date(query.dateTo);
    }

    const [summary, byType, monthly] = await Promise.all([
      reportRepository.aggregateTransactions([
        { $match: { ...userFilter, ...dateFilter } },
        { $group: {
          _id:          null,
          totalCredits: { $sum: { $cond: [{ $in: ['$type', ['CREDIT', 'TOPUP', 'COD_CREDIT', 'REFUND', 'SETTLEMENT', 'TRANSFER_CREDIT']] }, '$amount', 0] } },
          totalDebits:  { $sum: { $cond: [{ $in: ['$type', ['DEBIT', 'CHARGE', 'TRANSFER_DEBIT', 'DISPUTE_CHARGE', 'RTO_CHARGE']] }, '$amount', 0] } },
          totalDisputes: { $sum: { $cond: [{ $eq: ['$type', 'DISPUTE_CHARGE'] }, '$amount', 0] } },
          totalRTOCharges: { $sum: { $cond: [{ $eq: ['$type', 'RTO_CHARGE'] }, '$amount', 0] } },
          txCount:      { $sum: 1 },
        }},
      ]),
      reportRepository.aggregateTransactions([
        { $match: { ...userFilter, ...dateFilter } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort:  { total: -1 } },
      ]),
      reportRepository.aggregateTransactions([
        { $match: { ...userFilter, ...dateFilter } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          credits: { $sum: { $cond: [{ $in: ['$type', ['CREDIT', 'TOPUP', 'COD_CREDIT', 'REFUND', 'SETTLEMENT', 'TRANSFER_CREDIT']] }, '$amount', 0] } },
          debits:  { $sum: { $cond: [{ $in: ['$type', ['DEBIT', 'CHARGE', 'TRANSFER_DEBIT', 'DISPUTE_CHARGE', 'RTO_CHARGE']] }, '$amount', 0] } },
        }},
        { $sort: { _id: 1 } },
      ]),
    ]);

    return {
      summary: summary[0] || { totalCredits: 0, totalDebits: 0, totalDisputes: 0, totalRTOCharges: 0, txCount: 0 },
      byType:  byType.reduce((a, t) => { a[t._id] = { total: t.total, count: t.count }; return a; }, {}),
      monthly,
    };
  }); // end remember
};

// ─── Merchant Revenue Report (SA / Distributor only) ─────────────────────────
// GET /api/reports/merchant-revenue
const merchantRevenueReportService = async (query, caller) => {
  const cacheKey = KEYS.report('merchant-revenue', caller.userId, hashQuery(query));
  return remember(cacheKey, TTL.REPORT, async () => {
    if (![UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR].includes(caller.role)) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }

    const userMatch = caller.role === UserRole.DISTRIBUTOR
      ? { invitedBy: caller.userId, role: UserRole.MERCHANT, deletedAt: null }
      : { role: UserRole.MERCHANT, deletedAt: null };

    const merchants = await reportRepository.findUsers(userMatch, '_id firstName lastName email companyName');
    const merchantIds = merchants.map(m => m._id.toString());

    const dateFilter = {};
    if (query.dateFrom || query.dateTo) {
      dateFilter.createdAt = {};
      if (query.dateFrom) dateFilter.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo)   dateFilter.createdAt.$lte = new Date(query.dateTo);
    }

    const shipmentStats = await reportRepository.aggregateShipments([
      { $match: { merchantId: { $in: merchants.map(m => m._id) }, deletedAt: null, ...dateFilter } },
      { $group: {
        _id:       '$merchantId',
        total:     { $sum: 1 },
        delivered: { $sum: { $cond: [{ $eq: ['$status', ShipmentStatus.DELIVERED] }, 1, 0] } },
        failed:    { $sum: { $cond: [{ $in:  ['$status', [ShipmentStatus.DELIVERY_FAILED, ShipmentStatus.RTO]] }, 1, 0] } },
        codTotal:  { $sum: { $cond: ['$isCOD', '$codAmount', 0] } },
      }},
    ]);

    const statsMap = shipmentStats.reduce((a, s) => { a[s._id.toString()] = s; return a; }, {});

    return merchants.map(m => ({
      merchant: { id: m._id, firstName: m.firstName, lastName: m.lastName, email: m.email, companyName: m.companyName },
      shipments: statsMap[m._id.toString()] || { total: 0, delivered: 0, failed: 0, codTotal: 0 },
    }));
  }); // end remember
};

// ─── Performance Analytics (SA / Distributor) ─────────────────────────────────
// GET /api/reports/performance
const performanceReportService = async (query, caller) => {
  const cacheKey = KEYS.report('performance', caller.userId, hashQuery(query));
  return remember(cacheKey, TTL.REPORT, async () => {
    const filter = buildScope(caller, query);

    const [deliveryTimes, statusTrend] = await Promise.all([
      // Average delivery time (hours from CREATED → DELIVERED)
      reportRepository.aggregateShipments([
        { $match: { ...filter, status: ShipmentStatus.DELIVERED, deliveredAt: { $ne: null } } },
        { $project: {
          deliveryHours: { $divide: [{ $subtract: ['$deliveredAt', '$createdAt'] }, 3600000] },
        }},
        { $group: {
          _id:   null,
          avgHours: { $avg: '$deliveryHours' },
          minHours: { $min: '$deliveryHours' },
          maxHours: { $max: '$deliveryHours' },
        }},
      ]),

      // Weekly status trend (last 8 weeks)
      reportRepository.aggregateShipments([
        { $match: { ...filter, createdAt: { $gte: new Date(Date.now() - 56 * 24 * 60 * 60 * 1000) } } },
        { $group: {
          _id: {
            week:   { $isoWeek: '$createdAt' },
            year:   { $isoWeekYear: '$createdAt' },
            status: '$status',
          },
          count: { $sum: 1 },
        }},
        { $sort: { '_id.year': 1, '_id.week': 1 } },
      ]),
    ]);

    return {
      deliveryTime: deliveryTimes[0] || { avgHours: 0, minHours: 0, maxHours: 0 },
      weeklyTrend:  statusTrend,
    };
  }); // end remember
};

// ─── Wallet Report (SA sees breakdown, others see their own wallet stats) ────
const walletReportService = async (query, caller) => {
  const cacheKey = KEYS.report('wallet', caller.userId, hashQuery(query));
  return remember(cacheKey, TTL.REPORT, async () => {
    const dateFilter = {};
    if (query.dateFrom || query.dateTo) {
      dateFilter.createdAt = {};
      if (query.dateFrom) dateFilter.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo)   dateFilter.createdAt.$lte = new Date(query.dateTo);
    }

    if (caller.role !== UserRole.SUPER_ADMIN) {
      // Merchant or Distributor sees their own wallet stats
      const wallet = await reportRepository.findWalletByUserId(caller.userId);
      if (!wallet) throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });

      // Aggregate user's credits and debits breakdown
      const txSummary = await reportRepository.aggregateTransactions([
        { $match: { userId: caller.userId, ...dateFilter } },
        { $group: {
          _id: null,
          totalCredited: { $sum: { $cond: [{ $in: ['$type', ['CREDIT', 'TOPUP', 'COD_CREDIT', 'REFUND', 'TRANSFER_CREDIT']] }, '$amount', 0] } },
          totalDebited:  { $sum: { $cond: [{ $in: ['$type', ['DEBIT', 'CHARGE', 'TRANSFER_DEBIT', 'DISPUTE_CHARGE', 'RTO_CHARGE']] }, '$amount', 0] } },
          txCount:       { $sum: 1 },
        }},
      ]);

      return {
        balance:       wallet.balance,
        currency:      wallet.currency,
        isActive:      wallet.isActive,
        totalCredited: txSummary[0]?.totalCredited || 0,
        totalDebited:  txSummary[0]?.totalDebited || 0,
        txCount:       txSummary[0]?.txCount || 0,
      };
    }

    // Super Admin: aggregate overall wallet statistics
    const [overall, roleDistribution] = await Promise.all([
      reportRepository.aggregateWallets([
        { $group: {
          _id:           null,
          totalBalance:  { $sum: '$balance' },
          avgBalance:    { $avg: '$balance' },
          maxBalance:    { $max: '$balance' },
          activeCount:   { $sum: { $cond: ['$isActive', 1, 0] } },
          inactiveCount: { $sum: { $cond: ['$isActive', 0, 1] } },
          totalCount:    { $sum: 1 },
        }},
      ]),
      reportRepository.aggregateWallets([
        // Lookup user role
        { $lookup: {
          from:         'users',
          localField:   'userId',
          foreignField: '_id',
          as:           'user',
        }},
        { $unwind: '$user' },
        { $group: {
          _id:          '$user.role',
          totalBalance: { $sum: '$balance' },
          avgBalance:   { $avg: '$balance' },
          count:        { $sum: 1 },
        }},
      ]),
    ]);

    return {
      summary: overall[0] || { totalBalance: 0, avgBalance: 0, maxBalance: 0, activeCount: 0, inactiveCount: 0, totalCount: 0 },
      byRole:  roleDistribution.reduce((a, r) => { a[r._id] = { totalBalance: r.totalBalance, avgBalance: r.avgBalance, count: r.count }; return a; }, {}),
    };
  }); // end remember
};

// ─── COD Report (merchant/distributor scoped or SA global metrics) ───────────
const codReportService = async (query, caller) => {
  const cacheKey = KEYS.report('cod', caller.userId, hashQuery(query));
  return remember(cacheKey, TTL.REPORT, async () => {
    const filter = {};
    if (caller.role === UserRole.MERCHANT)     filter.merchantId    = caller.userId;
    else if (caller.role === UserRole.DISTRIBUTOR) filter.distributorId = caller.userId;
    else if (caller.role === UserRole.SUPER_ADMIN) {
      if (query.merchantId)    filter.merchantId    = query.merchantId;
      if (query.distributorId) filter.distributorId = query.distributorId;
    }

    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {};
      if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo)   filter.createdAt.$lte = new Date(query.dateTo);
    }

    const [totals, statusBreakdown] = await Promise.all([
      reportRepository.aggregateCod([
        { $match: filter },
        { $group: {
          _id:            null,
          totalCODAmount: { $sum: '$codAmount' },
          avgCODAmount:   { $avg: '$codAmount' },
          count:          { $sum: 1 },
        }},
      ]),
      reportRepository.aggregateCod([
        { $match: filter },
        { $group: {
          _id:    '$status',
          amount: { $sum: '$codAmount' },
          count:  { $sum: 1 },
        }},
      ]),
    ]);

    return {
      summary: totals[0] || { totalCODAmount: 0, avgCODAmount: 0, count: 0 },
      byStatus: statusBreakdown.reduce((a, s) => { a[s._id] = { amount: s.amount, count: s.count }; return a; }, {}),
    };
  }); // end remember
};

// ─── Payment Report (Razorpay top-ups success/failure rate & methods) ────────
const paymentReportService = async (query, caller) => {
  const cacheKey = KEYS.report('payment', caller.userId, hashQuery(query));
  return remember(cacheKey, TTL.REPORT, async () => {
    const filter = {};
    if (caller.role === UserRole.MERCHANT || caller.role === UserRole.DISTRIBUTOR) {
      filter.userId = caller.userId;
    } else if (caller.role === UserRole.SUPER_ADMIN) {
      if (query.userId) filter.userId = query.userId;
    } else {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }

    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {};
      if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo)   filter.createdAt.$lte = new Date(query.dateTo);
    }

    const [totals, statusBreakdown, methodBreakdown] = await Promise.all([
      reportRepository.aggregatePayments([
        { $match: filter },
        { $group: {
          _id:          null,
          totalAmount:  { $sum: '$amount' },
          avgAmount:    { $avg: '$amount' },
          count:        { $sum: 1 },
        }},
      ]),
      reportRepository.aggregatePayments([
        { $match: filter },
        { $group: {
          _id:    '$status',
          amount: { $sum: '$amount' },
          count:  { $sum: 1 },
        }},
      ]),
      reportRepository.aggregatePayments([
        { $match: { ...filter, status: 'SUCCESS' } },
        { $group: {
          _id:    { $ifNull: ['$paymentMethod', 'unknown'] },
          amount: { $sum: '$amount' },
          count:  { $sum: 1 },
        }},
      ]),
    ]);

    return {
      summary: totals[0] || { totalAmount: 0, avgAmount: 0, count: 0 },
      byStatus: statusBreakdown.reduce((a, s) => { a[s._id] = { amount: s.amount, count: s.count }; return a; }, {}),
      byMethod: methodBreakdown.reduce((a, m) => { a[m._id] = { amount: m.amount, count: m.count }; return a; }, {}),
    };
  }); // end remember
};

// ─── Super Admin Report Services (Route Aliases) ───────────────────────────────

const { Shipment } = require('../shipments/shipment.model');
const { User } = require('../users/user.model');
const { Wallet, Transaction } = require('../finance/finance.model');

// Overview Endpoint
const getReportsOverviewService = async (user) => {
  const totalShipments = await Shipment.countDocuments({ deletedAt: null });
  const totalMerchants = await User.countDocuments({ role: UserRole.MERCHANT, deletedAt: null });
  const totalDistributors = await User.countDocuments({ role: UserRole.DISTRIBUTOR, deletedAt: null });
  
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
  return { regionalPerformance: [] };
};

const getDistributorActivitiesService = async (query, user) => {
  const limit = parseInt(query.limit) || 20;
  
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
  shipmentReportService,
  revenueReportService,
  merchantRevenueReportService,
  performanceReportService,
  walletReportService,
  codReportService,
  paymentReportService,
  // Super Admin Report Services
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
