'use strict';

const { Shipment } = require('../shipment.model');
const { UserRole } = require('../../../constants');

/**
 * Build a Mongoose filter scoped to what the caller is allowed to see.
 */
const buildShipmentFilter = (caller, query = {}) => {
  const filter = { deletedAt: null };

  const mId = query.merchantId || query.merchant;
  const dId = query.distributorId || query.distributor;
  const wId = query.warehouseId || query.warehouse;

  // Scope by role first
  switch (caller.role) {
    case UserRole.DISTRIBUTOR:
      filter.distributorId = caller.userId;
      if (mId) filter.merchantId = mId;
      break;
    case UserRole.MERCHANT:
      filter.merchantId = caller.userId;
      break;
    case UserRole.WAREHOUSE:
      filter.warehouseId = caller.userId;
      break;
    // SUPER_ADMIN: no forced scope, but allow optional query filters below
  }

  // SA can optionally narrow down by these
  if (caller.role === UserRole.SUPER_ADMIN) {
    if (mId) filter.merchantId    = mId;
    if (dId) filter.distributorId = dId;
    if (wId) filter.warehouseId   = wId;
  }

  // Common optional filters available to all roles
  if (query.status) filter.status = query.status;

  if (query.search) {
    // Escape special regex characters to prevent ReDoS attacks
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { awb:              { $regex: escaped, $options: 'i' } },
      { merchantOrderRef: { $regex: escaped, $options: 'i' } },
      { invoiceNumber:    { $regex: escaped, $options: 'i' } },
    ];
  }

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo)   filter.createdAt.$lte = new Date(query.dateTo);
  }

  return filter;
};

/**
 * Fetch a single shipment and verify the caller is allowed to access it.
 */
const findShipmentWithAccess = async (shipmentId, caller) => {
  const shipment = await Shipment.findOne({ _id: shipmentId, deletedAt: null })
    .populate('merchantId',    'firstName lastName email companyName')
    .populate('distributorId', 'firstName lastName email companyName')
    .populate('warehouseId',   'firstName lastName email companyName');

  if (!shipment) {
    const err = new Error('Shipment not found.');
    err.statusCode = 404;
    throw err;
  }

  const isAllowed =
    caller.role === UserRole.SUPER_ADMIN ||
    (caller.role === UserRole.MERCHANT    && shipment.merchantId?._id.toString()    === caller.userId.toString()) ||
    (caller.role === UserRole.DISTRIBUTOR && shipment.distributorId?._id.toString() === caller.userId.toString()) ||
    (caller.role === UserRole.WAREHOUSE   && shipment.warehouseId?._id.toString()   === caller.userId.toString());

  if (!isAllowed) {
    const err = new Error('Access denied.');
    err.statusCode = 403;
    throw err;
  }

  return shipment;
};

module.exports = {
  buildShipmentFilter,
  findShipmentWithAccess,
};
