'use strict';

const { WarehouseChangeRequest } = require('./warehouse-change-request.model');

/**
 * WarehouseChangeRequest Repository
 * Pure data-access layer — no business logic, no try/catch.
 */

/** Create a new warehouse change request document. */
const create = (data, session) => {
  if (session) {
    return WarehouseChangeRequest.create([data], { session }).then((res) => res[0]);
  }
  return WarehouseChangeRequest.create(data);
};

/** Find a change request by its ObjectId. */
const findById = (id) => WarehouseChangeRequest.findById(id);

/** Find requests for a warehouse, optionally filtered by status. */
const findByWarehouse = (warehouseId, status) => {
  const query = { warehouseId };
  if (status) query.status = status;
  return WarehouseChangeRequest.find(query).sort({ createdAt: -1 });
};

/** Find paginated requests for a merchant. Returns [requests[], total]. */
const findByMerchant = async (merchantId, filter = {}, { skip = 0, limit = 20, sort = { createdAt: -1 } } = {}) => {
  const query = { merchantId, ...filter };
  return Promise.all([
    WarehouseChangeRequest.find(query).sort(sort).skip(skip).limit(limit),
    WarehouseChangeRequest.countDocuments(query),
  ]);
};

/** Find paginated requests for a distributor. Returns [requests[], total]. */
const findByDistributor = async (distributorId, filter = {}, { skip = 0, limit = 20, sort = { createdAt: -1 } } = {}) => {
  const query = { distributorId, ...filter };
  return Promise.all([
    WarehouseChangeRequest.find(query).sort(sort).skip(skip).limit(limit),
    WarehouseChangeRequest.countDocuments(query),
  ]);
};

/** Update a change request by ID and return the updated document. */
const update = (id, data, options = {}) =>
  WarehouseChangeRequest.findByIdAndUpdate(id, data, { returnDocument: 'after', ...options });

/** Count requests for a merchant matching a filter. */
const countByMerchant = (merchantId, filter = {}) =>
  WarehouseChangeRequest.countDocuments({ merchantId, ...filter });

/** Count requests for a distributor matching a filter. */
const countByDistributor = (distributorId, filter = {}) =>
  WarehouseChangeRequest.countDocuments({ distributorId, ...filter });

module.exports = {
  create,
  findById,
  findByWarehouse,
  findByMerchant,
  findByDistributor,
  update,
  countByMerchant,
  countByDistributor,
};
