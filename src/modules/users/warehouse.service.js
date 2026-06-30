'use strict';

const warehouseRepository = require('./warehouse.repository');
const { logAuditEvent } = require('../audit/audit.service');

/**
 * Get all active warehouses for a given merchant.
 *
 * @param {string} merchantId - Owning merchant ObjectId
 * @returns {Promise<Array>} List of active warehouses
 */
const getWarehousesService = async (merchantId) => {
  return warehouseRepository.findAllByMerchantId(merchantId);
};

/**
 * Get a single warehouse by ID, enforcing merchant ownership.
 *
 * @param {string} warehouseId - Warehouse ObjectId
 * @param {string} merchantId - Requesting merchant ObjectId
 * @returns {Promise<Object>} Warehouse document
 */
const getWarehouseByIdService = async (warehouseId, merchantId) => {
  const warehouse = await warehouseRepository.findById(warehouseId);

  if (!warehouse) {
    throw Object.assign(new Error('Warehouse not found'), { statusCode: 404 });
  }

  if (warehouse.merchantId.toString() !== merchantId.toString()) {
    throw Object.assign(new Error('Access denied. Warehouse does not belong to you.'), { statusCode: 403 });
  }

  return warehouse;
};

/**
 * Update warehouse contact details immediately without requiring approval.
 * Logs an audit event upon success.
 *
 * @param {string} warehouseId - Warehouse ObjectId
 * @param {Object} dto - Update data (contactPerson, phone, email)
 * @param {string} merchantId - Requesting merchant ObjectId
 * @returns {Promise<Object>} Updated warehouse document
 */
const updateContactService = async (warehouseId, dto, merchantId) => {
  const warehouse = await warehouseRepository.findById(warehouseId);

  if (!warehouse) {
    throw Object.assign(new Error('Warehouse not found'), { statusCode: 404 });
  }

  if (warehouse.merchantId.toString() !== merchantId.toString()) {
    throw Object.assign(new Error('Access denied. Warehouse does not belong to you.'), { statusCode: 403 });
  }

  const fields = ['contactPerson', 'phone', 'email'];
  const updatedFields = [];
  for (const field of fields) {
    if (dto[field] !== undefined) {
      warehouse[field] = dto[field];
      updatedFields.push(field);
    }
  }

  await warehouseRepository.save(warehouse);

  logAuditEvent(
    merchantId,
    'WAREHOUSE_CONTACT_UPDATED',
    { warehouseId: warehouse._id, updatedFields },
    warehouse._id,
  );

  return warehouse;
};

module.exports = {
  getWarehousesService,
  getWarehouseByIdService,
  updateContactService,
};
