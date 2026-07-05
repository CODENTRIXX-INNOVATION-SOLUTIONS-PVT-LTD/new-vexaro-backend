'use strict';

const { AddressBook } = require('./address-book.model');

/**
 * AddressBook Repository
 * Pure data-access layer — no business logic, no try/catch.
 * All functions return Mongoose documents, arrays, or null.
 */

/**
 * Find a non-deleted address by ID and merchant ID.
 * @param {string} id - Address book entry ID
 * @param {string} merchantId - Merchant user ID
 * @returns {Promise<Document|null>} Address book document or null
 */
const findById = (id, merchantId) =>
  AddressBook.findOne({ _id: id, merchantId, deletedAt: null });

/**
 * Find addresses by merchant with filtering and pagination.
 * @param {string} merchantId - Merchant user ID
 * @param {Object} filter - Additional filter criteria (label, search)
 * @param {Object} options - Pagination options { skip, limit, sort }
 * @returns {Promise<Array>} Array of address book documents
 */
const findByMerchant = (merchantId, filter = {}, options = {}) => {
  const { skip = 0, limit = 20, sort = { lastUsedAt: -1, createdAt: -1 } } = options;
  
  // Build query filter
  const query = { merchantId, deletedAt: null, ...filter };
  
  return AddressBook.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

/**
 * Count addresses by merchant with filtering.
 * @param {string} merchantId - Merchant user ID
 * @param {Object} filter - Additional filter criteria (label, search)
 * @returns {Promise<number>} Count of matching addresses
 */
const countByMerchant = (merchantId, filter = {}) => {
  const query = { merchantId, deletedAt: null, ...filter };
  return AddressBook.countDocuments(query);
};

/**
 * Create a new address book entry.
 * @param {Object} data - Address book entry data
 * @returns {Promise<Document>} Created address book document
 */
const create = (data) => AddressBook.create(data);

/**
 * Update an existing address by ID and merchant ID.
 * @param {string} id - Address book entry ID
 * @param {string} merchantId - Merchant user ID
 * @param {Object} data - Updated address data
 * @returns {Promise<Document|null>} Updated address book document or null
 */
const update = (id, merchantId, data) =>
  AddressBook.findOneAndUpdate(
    { _id: id, merchantId, deletedAt: null },
    data,
    { returnDocument: 'after', runValidators: true }
  );

/**
 * Soft delete an address by setting deletedAt timestamp.
 * @param {string} id - Address book entry ID
 * @param {string} merchantId - Merchant user ID
 * @returns {Promise<Document|null>} Deleted address book document or null
 */
const softDelete = (id, merchantId) =>
  AddressBook.findOneAndUpdate(
    { _id: id, merchantId, deletedAt: null },
    { deletedAt: new Date() },
    { returnDocument: 'after' }
  );

/**
 * Mark an address as used by updating lastUsedAt timestamp.
 * @param {string} id - Address book entry ID
 * @param {string} merchantId - Merchant user ID
 * @returns {Promise<Document|null>} Updated address book document or null
 */
const markAsUsed = (id, merchantId) =>
  AddressBook.findOneAndUpdate(
    { _id: id, merchantId, deletedAt: null },
    { lastUsedAt: new Date() },
    { returnDocument: 'after' }
  );

module.exports = {
  findById,
  findByMerchant,
  countByMerchant,
  create,
  update,
  softDelete,
  markAsUsed,
};
