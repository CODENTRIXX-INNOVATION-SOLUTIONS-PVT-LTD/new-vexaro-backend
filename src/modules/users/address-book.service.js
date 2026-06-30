'use strict';

const addressBookRepository = require('./address-book.repository');
const userRepository = require('./user.repository');
const { UserRole } = require('../../constants');
const logger = require('../../utils/logger');

/**
 * AddressBook Service
 * Business logic for address book operations.
 * Throws errors with statusCode for controller to handle.
 */

/**
 * Validate merchant exists and is active
 * @param {string} merchantId - Merchant user ID
 * @throws {Error} 403 if merchant not found or not active
 */
const validateMerchant = async (merchantId) => {
  const merchant = await userRepository.findById(merchantId);
  
  if (!merchant || merchant.deletedAt) {
    throw Object.assign(new Error('Merchant not found'), { statusCode: 403 });
  }
  
  if (!merchant.isActive) {
    throw Object.assign(new Error('Merchant account is not active'), { statusCode: 403 });
  }
  
  if (merchant.role !== UserRole.MERCHANT) {
    throw Object.assign(new Error('Only merchants can manage address book'), { statusCode: 403 });
  }
};

/**
 * Create a new address book entry
 * @param {Object} dto - Address data (validated by controller)
 * @param {string} merchantId - Merchant user ID
 * @returns {Promise<Object>} Created address
 */
const createAddressService = async (dto, merchantId) => {
  // Validate merchant exists and is active
  await validateMerchant(merchantId);

  // Create address with merchantId
  const addressData = {
    ...dto,
    merchantId,
  };

  const address = await addressBookRepository.create(addressData);

  logger.info('address_created', {
    addressId: address._id,
    merchantId,
    label: address.label,
  });

  return address;
};

/**
 * List addresses for a merchant with filtering and pagination
 * @param {Object} query - Query parameters { page, pageSize, label, search }
 * @param {string} merchantId - Merchant user ID
 * @returns {Promise<Object>} { addresses: [], pagination: {} }
 */
const listAddressesService = async (query, merchantId) => {
  // Validate merchant exists and is active
  await validateMerchant(merchantId);

  const { page = 1, pageSize = 20, label, search } = query;

  // Build filter object
  const filter = {};

  // Add label filter if provided
  if (label) {
    filter.label = label;
  }

  // Add search filter if provided (search across name, phone, email, city)
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { city: { $regex: search, $options: 'i' } },
    ];
  }

  // Calculate pagination
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  // Sort by: lastUsedAt DESC NULLS LAST, then createdAt DESC
  // MongoDB sorts null values first in descending order, so we need custom sort
  const sort = { lastUsedAt: -1, createdAt: -1 };

  // Fetch addresses and count
  const [addresses, total] = await Promise.all([
    addressBookRepository.findByMerchant(merchantId, filter, { skip, limit, sort }),
    addressBookRepository.countByMerchant(merchantId, filter),
  ]);

  // MongoDB sorts null lastUsedAt first when descending, but we want them last
  // So we need to manually sort: non-null lastUsedAt DESC, then null lastUsedAt, then createdAt DESC
  const sortedAddresses = addresses.sort((a, b) => {
    // If both have lastUsedAt, sort by it descending
    if (a.lastUsedAt && b.lastUsedAt) {
      return b.lastUsedAt - a.lastUsedAt;
    }
    // If a has lastUsedAt but b doesn't, a comes first
    if (a.lastUsedAt && !b.lastUsedAt) {
      return -1;
    }
    // If b has lastUsedAt but a doesn't, b comes first
    if (!a.lastUsedAt && b.lastUsedAt) {
      return 1;
    }
    // If neither has lastUsedAt, sort by createdAt descending
    return b.createdAt - a.createdAt;
  });

  return {
    addresses: sortedAddresses,
    pagination: {
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
    },
  };
};

/**
 * Get a single address by ID
 * @param {string} addressId - Address ID
 * @param {string} merchantId - Merchant user ID
 * @returns {Promise<Object>} Address document
 * @throws {Error} 404 if not found, 403 if access denied
 */
const getAddressByIdService = async (addressId, merchantId) => {
  const address = await addressBookRepository.findById(addressId, merchantId);

  if (!address) {
    throw Object.assign(new Error('Address not found'), { statusCode: 404 });
  }

  return address;
};

/**
 * Update an address by ID
 * @param {string} addressId - Address ID
 * @param {Object} dto - Updated address data (validated by controller)
 * @param {string} merchantId - Merchant user ID
 * @returns {Promise<Object>} Updated address document
 * @throws {Error} 404 if not found, 403 if access denied
 */
const updateAddressService = async (addressId, dto, merchantId) => {
  // Check if address exists and belongs to merchant
  const existingAddress = await addressBookRepository.findById(addressId, merchantId);

  if (!existingAddress) {
    throw Object.assign(new Error('Address not found'), { statusCode: 404 });
  }

  // Update address
  const updatedAddress = await addressBookRepository.update(addressId, merchantId, dto);

  if (!updatedAddress) {
    throw Object.assign(new Error('Failed to update address'), { statusCode: 500 });
  }

  logger.info('address_updated', {
    addressId,
    merchantId,
    updatedFields: Object.keys(dto),
  });

  return updatedAddress;
};

/**
 * Soft delete an address by ID
 * @param {string} addressId - Address ID
 * @param {string} merchantId - Merchant user ID
 * @returns {Promise<Object>} Success message
 * @throws {Error} 404 if not found, 403 if access denied
 */
const deleteAddressService = async (addressId, merchantId) => {
  // Check if address exists and belongs to merchant
  const existingAddress = await addressBookRepository.findById(addressId, merchantId);

  if (!existingAddress) {
    throw Object.assign(new Error('Address not found'), { statusCode: 404 });
  }

  // Soft delete
  const deletedAddress = await addressBookRepository.softDelete(addressId, merchantId);

  if (!deletedAddress) {
    throw Object.assign(new Error('Failed to delete address'), { statusCode: 500 });
  }

  logger.info('address_deleted', {
    addressId,
    merchantId,
  });

  return { message: 'Address deleted successfully' };
};

/**
 * Mark an address as used by updating lastUsedAt timestamp
 * @param {string} addressId - Address ID
 * @param {string} merchantId - Merchant user ID
 * @returns {Promise<void>}
 * @note This method fails silently if address not found (per design spec)
 */
const markAddressUsedService = async (addressId, merchantId) => {
  try {
    const address = await addressBookRepository.markAsUsed(addressId, merchantId);
    
    if (address) {
      logger.info('address_marked_used', {
        addressId,
        merchantId,
        lastUsedAt: address.lastUsedAt,
      });
    }
  } catch (error) {
    // Fail silently as per design spec
    logger.warn('address_mark_used_failed', {
      addressId,
      merchantId,
      error: error.message,
    });
  }
};

module.exports = {
  createAddressService,
  listAddressesService,
  getAddressByIdService,
  updateAddressService,
  deleteAddressService,
  markAddressUsedService,
};
