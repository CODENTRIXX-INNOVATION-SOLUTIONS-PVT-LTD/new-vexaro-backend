'use strict';

const { Warehouse } = require('./warehouse.model');

/**
 * Warehouse Repository
 * Pure data-access layer — no business logic, no try/catch.
 */

/** Find a warehouse by its MongoDB _id. */
const findById = (id) => Warehouse.findById(id);

/** Find one warehouse matching a filter, optionally within a session. */
const findOne = (filter, session) => {
  const q = Warehouse.findOne(filter);
  return session ? q.session(session) : q;
};

/** Find active warehouse for a given merchantId (first match). */
const findActiveByMerchantId = (merchantId) =>
  Warehouse.findOne({ merchantId, isActive: true });

/** Find a warehouse by merchantId (first match). */
const findByMerchantId = (merchantId) =>
  Warehouse.findOne({ merchantId });

/** Find all active warehouses for a merchant. */
const findAllByMerchantId = (merchantId) =>
  Warehouse.find({ merchantId, isActive: true }).sort({ createdAt: -1 });

/** Find warehouse by ID and merchantId (ownership check). */
const findByIdAndMerchant = (warehouseId, merchantId) =>
  Warehouse.findOne({ _id: warehouseId, merchantId });

/** Update contact info for a warehouse. */
const updateContact = (warehouseId, contactData, options = {}) =>
  Warehouse.findByIdAndUpdate(warehouseId, { $set: contactData }, { returnDocument: 'after', ...options });

/** Update address for a warehouse. */
const updateAddress = (warehouseId, addressData, options = {}) =>
  Warehouse.findByIdAndUpdate(warehouseId, { $set: addressData }, { returnDocument: 'after', ...options });

/** Create one or more warehouse documents inside a session. */
const createInSession = (data, session) =>
  Warehouse.create([data], { session });

/** Update a warehouse by its _id and return the updated document. */
const findByIdAndUpdate = (id, update, options = {}) =>
  Warehouse.findByIdAndUpdate(id, update, { returnDocument: 'after', ...options });

/** Save a warehouse document (triggers pre-save hooks). */
const save = (warehouse, options = {}) => warehouse.save(options);

/** Generate a unique warehouse ID (delegating to model static). */
const generateWarehouseId = (state) => Warehouse.generateWarehouseId(state);

module.exports = {
  findById,
  findOne,
  findActiveByMerchantId,
  findByMerchantId,
  findAllByMerchantId,
  findByIdAndMerchant,
  updateContact,
  updateAddress,
  createInSession,
  findByIdAndUpdate,
  save,
  generateWarehouseId,
};
