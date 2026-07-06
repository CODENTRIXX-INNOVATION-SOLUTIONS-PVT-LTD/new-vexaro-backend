'use strict';

const { Shipment } = require('../shipment.model');
const { buildShipmentFilter } = require('../shared/shipment.helpers');
const { remember, TTL, KEYS } = require('../../../utils/cache');
const { ShipmentStatus } = require('../../../constants');

const toDateKey = (date) => date.toISOString().slice(0, 10);

const buildRecentDays = (count = 7) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (count - index - 1));
    return {
      date,
      key: toDateKey(date),
      label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    };
  });
};

const bucketStatus = (status) => {
  if (status === ShipmentStatus.DELIVERED) return 'delivered';
  if ([ShipmentStatus.PICKED_UP, ShipmentStatus.ARRIVED_AT_HUB, ShipmentStatus.OUT_FOR_DELIVERY].includes(status)) return 'inTransit';
  if (status === ShipmentStatus.ORDER_CREATED) return 'pending';
  if (status === ShipmentStatus.DELIVERY_FAILED) return 'failed';
  if (status === ShipmentStatus.RTO) return 'rto';
  if (status === ShipmentStatus.CANCELLED) return 'cancelled';
  return 'other';
};

const shipmentStatsService = async (caller) => {
  const cacheKey = KEYS.shipmentStats(caller.userId);
  return remember(cacheKey, TTL.SHIPMENT_STATS, async () => {
    const baseFilter = buildShipmentFilter(caller);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const recentDays = buildRecentDays(7);
    const trendStart = recentDays[0].date;

    const [total, byStatus, todayCount, costAgg, trendAgg, destinationAgg] = await Promise.all([
      Shipment.countDocuments(baseFilter),
      Shipment.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Shipment.countDocuments({
        ...baseFilter,
        createdAt: { $gte: todayStart },
      }),
      Shipment.aggregate([
        { $match: baseFilter },
        { $group: { _id: null, totalCost: { $sum: '$merchantCost' } } },
      ]),
      Shipment.aggregate([
        { $match: { ...baseFilter, createdAt: { $gte: trendStart } } },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              status: '$status',
            },
            count: { $sum: 1 },
          },
        },
      ]),
      Shipment.aggregate([
        { $match: { ...baseFilter, 'destination.city': { $nin: [null, ''] } } },
        {
          $group: {
            _id: { $trim: { input: '$destination.city' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 5 },
      ]),
    ]);

    const statusBreakdown = byStatus.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});

    const statusTrend = recentDays.map(({ key, label }) => ({
      date: key,
      label,
      delivered: 0,
      inTransit: 0,
      pending: 0,
      failed: 0,
      rto: 0,
      cancelled: 0,
      total: 0,
    }));

    const trendByDay = statusTrend.reduce((acc, item) => {
      acc[item.date] = item;
      return acc;
    }, {});

    trendAgg.forEach(({ _id, count }) => {
      const row = trendByDay[_id.day];
      if (!row) return;
      const bucket = bucketStatus(_id.status);
      if (Object.prototype.hasOwnProperty.call(row, bucket)) row[bucket] += count;
      row.total += count;
    });

    const topDestinations = destinationAgg.map(({ _id, count }) => ({
      city: _id,
      count,
    }));

    return {
      total,
      today: todayCount,
      byStatus: statusBreakdown,
      totalCost: costAgg[0]?.totalCost || 0,
      statusTrend,
      topDestinations,
    };
  });
};

module.exports = {
  shipmentStatsService,
};
