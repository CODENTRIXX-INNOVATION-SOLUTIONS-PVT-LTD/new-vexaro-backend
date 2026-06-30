'use strict';

const { Shipment } = require('../shipment.model');
const { buildShipmentFilter } = require('../shared/shipment.helpers');
const { remember, TTL, KEYS } = require('../../../utils/cache');

const shipmentStatsService = async (caller) => {
  const cacheKey = KEYS.shipmentStats(caller.userId);
  return remember(cacheKey, TTL.SHIPMENT_STATS, async () => {
    const baseFilter = buildShipmentFilter(caller);

    const [total, byStatus, todayCount] = await Promise.all([
      Shipment.countDocuments(baseFilter),
      Shipment.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Shipment.countDocuments({
        ...baseFilter,
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
    ]);

    const statusBreakdown = byStatus.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});

    return { total, today: todayCount, byStatus: statusBreakdown };
  });
};

module.exports = {
  shipmentStatsService,
};
