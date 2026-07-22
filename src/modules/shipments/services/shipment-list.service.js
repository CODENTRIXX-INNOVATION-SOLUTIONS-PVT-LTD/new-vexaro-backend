'use strict';

const { Shipment } = require('../shipment.model');
const { buildShipmentFilter } = require('../shared/shipment.helpers');
const { getPaginationParams } = require('../../../utils/pagination');
const { syncListedShipmentsFromVelocity } = require('./shipment-velocity-sync.service');

const listShipmentsService = async (query, caller) => {
  const filter = buildShipmentFilter(caller, query);
  const { limit, skip } = getPaginationParams(query, 20);

  const [shipments, total] = await Promise.all([
    Shipment.find(filter)
      .populate('merchantId',    'firstName lastName email companyName')
      .populate('distributorId', 'firstName lastName email companyName')
      .populate('warehouseId',   'firstName lastName email companyName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Shipment.countDocuments(filter),
  ]);

  await syncListedShipmentsFromVelocity(shipments);

  return {
    items: shipments,
    total,
  };
};

module.exports = {
  listShipmentsService,
};
