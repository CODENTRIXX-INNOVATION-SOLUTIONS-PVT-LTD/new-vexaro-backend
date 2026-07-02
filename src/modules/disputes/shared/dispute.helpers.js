'use strict';

const { UserRole } = require('../../../constants');
const shipmentRepository = require('../../shipments/shipment.repository');

const buildFilter = async (caller, query) => {
  const filter = {};

  if (caller.role === UserRole.MERCHANT) {
    filter.raisedBy = caller.userId;
  } else if (caller.role === UserRole.DISTRIBUTOR) {
    const shipments = await shipmentRepository.findAll({ distributorId: caller.userId }, '_id');
    filter.shipmentId = { $in: shipments.map(s => s._id) };
  }

  if (query.status)     filter.status     = query.status;
  if (query.category)   filter.category   = query.category;
  if (query.shipmentId) filter.shipmentId = query.shipmentId;
  return filter;
};

const buildWeightDisputeFilter = async (caller, query) => {
  const filter = {};

  if (caller.role === UserRole.MERCHANT) {
    const shipments = await shipmentRepository.findAll({ merchantId: caller.userId }, '_id');
    filter.shipmentId = { $in: shipments.map(s => s._id) };
  } else if (caller.role === UserRole.DISTRIBUTOR) {
    const shipments = await shipmentRepository.findAll({ distributorId: caller.userId }, '_id');
    filter.shipmentId = { $in: shipments.map(s => s._id) };
  }

  if (query.status) filter.status = query.status;
  if (query.shipmentId) filter.shipmentId = query.shipmentId;
  return filter;
};

module.exports = {
  buildFilter,
  buildWeightDisputeFilter,
};
