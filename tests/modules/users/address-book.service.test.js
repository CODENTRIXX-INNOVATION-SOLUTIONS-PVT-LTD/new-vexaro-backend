'use strict';

/**
 * AddressBook Service Unit Tests (canonical test suite)
 *
 * Covers all service functions with full mock isolation of the
 * repository layer and userRepository. Validates business rules,
 * authorization checks, sorting logic, and error status codes.
 */

const addressBookService = require('../../../src/modules/users/address-book.service');
const addressBookRepository = require('../../../src/modules/users/address-book.repository');
const userRepository = require('../../../src/modules/users/user.repository');
const { UserRole } = require('../../../src/constants');

// ─── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../../src/modules/users/address-book.repository');
jest.mock('../../../src/modules/users/user.repository');
jest.mock('../../../src/utils/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MERCHANT_ID = '507f1f77bcf86cd799439011';
const ADDRESS_ID  = '507f1f77bcf86cd799439012';

const mockMerchant = {
  _id:       MERCHANT_ID,
  email:     'merchant@example.com',
  role:      UserRole.MERCHANT,
  isActive:  true,
  deletedAt: null,
};

const mockAddress = {
  _id:         ADDRESS_ID,
  merchantId:  MERCHANT_ID,
  name:        'John Doe',
  phone:       '9876543210',
  email:       'john@example.com',
  addressLine: '123 Main Street',
  city:        'Mumbai',
  state:       'Maharashtra',
  pincode:     '400001',
  country:     'India',
  label:       'Store',
  lastUsedAt:  null,
  deletedAt:   null,
  createdAt:   new Date('2024-01-01'),
  updatedAt:   new Date('2024-01-01'),
};

const createDto = {
  name:        'John Doe',
  phone:       '9876543210',
  email:       'john@example.com',
  addressLine: '123 Main Street',
  city:        'Mumbai',
  state:       'Maharashtra',
  pincode:     '400001',
  country:     'India',
  label:       'Store',
};

// ─── createAddressService ──────────────────────────────────────────────────────

describe('createAddressService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates and returns address when merchant is valid', async () => {
    userRepository.findById.mockResolvedValue(mockMerchant);
    addressBookRepository.create.mockResolvedValue(mockAddress);

    const result = await addressBookService.createAddressService(createDto, MERCHANT_ID);

    expect(userRepository.findById).toHaveBeenCalledWith(MERCHANT_ID);
    expect(addressBookRepository.create).toHaveBeenCalledWith({ ...createDto, merchantId: MERCHANT_ID });
    expect(result).toEqual(mockAddress);
  });

  test('throws 403 when merchant not found (null)', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(addressBookService.createAddressService(createDto, MERCHANT_ID))
      .rejects.toMatchObject({ message: 'Merchant not found', statusCode: 403 });
    expect(addressBookRepository.create).not.toHaveBeenCalled();
  });

  test('throws 403 when merchant has deletedAt set (soft-deleted)', async () => {
    userRepository.findById.mockResolvedValue({ ...mockMerchant, deletedAt: new Date() });

    await expect(addressBookService.createAddressService(createDto, MERCHANT_ID))
      .rejects.toMatchObject({ message: 'Merchant not found', statusCode: 403 });
  });

  test('throws 403 when merchant account is inactive', async () => {
    userRepository.findById.mockResolvedValue({ ...mockMerchant, isActive: false });

    await expect(addressBookService.createAddressService(createDto, MERCHANT_ID))
      .rejects.toMatchObject({ message: 'Merchant account is not active', statusCode: 403 });
  });

  test('throws 403 when user is not a merchant role', async () => {
    userRepository.findById.mockResolvedValue({ ...mockMerchant, role: UserRole.DISTRIBUTOR });

    await expect(addressBookService.createAddressService(createDto, MERCHANT_ID))
      .rejects.toMatchObject({ message: 'Only merchants can manage address book', statusCode: 403 });
  });

  test('propagates repository errors without swallowing them', async () => {
    userRepository.findById.mockResolvedValue(mockMerchant);
    addressBookRepository.create.mockRejectedValue(new Error('DB connection error'));

    await expect(addressBookService.createAddressService(createDto, MERCHANT_ID))
      .rejects.toThrow('DB connection error');
  });
});

// ─── listAddressesService ──────────────────────────────────────────────────────

describe('listAddressesService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns addresses with default pagination', async () => {
    userRepository.findById.mockResolvedValue(mockMerchant);
    addressBookRepository.findByMerchant.mockResolvedValue([mockAddress]);
    addressBookRepository.countByMerchant.mockResolvedValue(1);

    const result = await addressBookService.listAddressesService({}, MERCHANT_ID);

    expect(result.pagination).toEqual({ total: 1, page: 1, pageSize: 20, pages: 1 });
    expect(result.addresses).toHaveLength(1);
  });

  test('applies correct skip/limit for page 3 with pageSize 5', async () => {
    userRepository.findById.mockResolvedValue(mockMerchant);
    addressBookRepository.findByMerchant.mockResolvedValue([]);
    addressBookRepository.countByMerchant.mockResolvedValue(0);

    await addressBookService.listAddressesService({ page: 3, pageSize: 5 }, MERCHANT_ID);

    expect(addressBookRepository.findByMerchant).toHaveBeenCalledWith(
      MERCHANT_ID,
      {},
      { skip: 10, limit: 5, sort: { lastUsedAt: -1, createdAt: -1 } },
    );
  });

  test('applies label filter when provided', async () => {
    userRepository.findById.mockResolvedValue(mockMerchant);
    addressBookRepository.findByMerchant.mockResolvedValue([mockAddress]);
    addressBookRepository.countByMerchant.mockResolvedValue(1);

    await addressBookService.listAddressesService({ label: 'Store' }, MERCHANT_ID);

    expect(addressBookRepository.findByMerchant).toHaveBeenCalledWith(
      MERCHANT_ID,
      { label: 'Store' },
      expect.any(Object),
    );
  });

  test('applies search filter across name/phone/email/city', async () => {
    userRepository.findById.mockResolvedValue(mockMerchant);
    addressBookRepository.findByMerchant.mockResolvedValue([mockAddress]);
    addressBookRepository.countByMerchant.mockResolvedValue(1);

    await addressBookService.listAddressesService({ search: 'john' }, MERCHANT_ID);

    expect(addressBookRepository.findByMerchant).toHaveBeenCalledWith(
      MERCHANT_ID,
      {
        $or: [
          { name:  { $regex: 'john', $options: 'i' } },
          { phone: { $regex: 'john', $options: 'i' } },
          { email: { $regex: 'john', $options: 'i' } },
          { city:  { $regex: 'john', $options: 'i' } },
        ],
      },
      expect.any(Object),
    );
  });

  test('sorts addresses: lastUsedAt DESC NULLS LAST, then createdAt DESC', async () => {
    const recently  = { ...mockAddress, _id: 'a1', lastUsedAt: new Date('2024-03-01'), createdAt: new Date('2024-01-01') };
    const older     = { ...mockAddress, _id: 'a2', lastUsedAt: new Date('2024-01-15'), createdAt: new Date('2024-01-01') };
    const neverNew  = { ...mockAddress, _id: 'a3', lastUsedAt: null,                  createdAt: new Date('2024-02-20') };
    const neverOld  = { ...mockAddress, _id: 'a4', lastUsedAt: null,                  createdAt: new Date('2024-01-10') };

    userRepository.findById.mockResolvedValue(mockMerchant);
    addressBookRepository.findByMerchant.mockResolvedValue([neverOld, recently, neverNew, older]);
    addressBookRepository.countByMerchant.mockResolvedValue(4);

    const { addresses } = await addressBookService.listAddressesService({}, MERCHANT_ID);

    // Expected: recently used → older used → never used (newer created) → never used (older created)
    expect(addresses[0]._id).toBe('a1');
    expect(addresses[1]._id).toBe('a2');
    expect(addresses[2]._id).toBe('a3');
    expect(addresses[3]._id).toBe('a4');
  });

  test('throws 403 for inactive merchant', async () => {
    userRepository.findById.mockResolvedValue({ ...mockMerchant, isActive: false });

    await expect(addressBookService.listAddressesService({}, MERCHANT_ID))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  test('returns empty addresses array when none exist', async () => {
    userRepository.findById.mockResolvedValue(mockMerchant);
    addressBookRepository.findByMerchant.mockResolvedValue([]);
    addressBookRepository.countByMerchant.mockResolvedValue(0);

    const result = await addressBookService.listAddressesService({}, MERCHANT_ID);

    expect(result.addresses).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.pages).toBe(0);
  });
});

// ─── getAddressByIdService ─────────────────────────────────────────────────────

describe('getAddressByIdService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns address when it exists and belongs to merchant', async () => {
    addressBookRepository.findById.mockResolvedValue(mockAddress);

    const result = await addressBookService.getAddressByIdService(ADDRESS_ID, MERCHANT_ID);

    expect(addressBookRepository.findById).toHaveBeenCalledWith(ADDRESS_ID, MERCHANT_ID);
    expect(result).toEqual(mockAddress);
  });

  test('throws 404 when address not found', async () => {
    addressBookRepository.findById.mockResolvedValue(null);

    await expect(addressBookService.getAddressByIdService(ADDRESS_ID, MERCHANT_ID))
      .rejects.toMatchObject({ message: 'Address not found', statusCode: 404 });
  });

  test('throws 404 when address belongs to a different merchant (repository returns null)', async () => {
    // Repository enforces ownership via { merchantId } filter — returns null if mismatch
    addressBookRepository.findById.mockResolvedValue(null);

    await expect(addressBookService.getAddressByIdService(ADDRESS_ID, 'differentMerchantId'))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── updateAddressService ──────────────────────────────────────────────────────

describe('updateAddressService', () => {
  beforeEach(() => jest.clearAllMocks());

  const updateDto = { name: 'Jane Doe', phone: '9876543211' };

  test('returns updated address when address exists', async () => {
    const updated = { ...mockAddress, ...updateDto };
    addressBookRepository.findById.mockResolvedValue(mockAddress);
    addressBookRepository.update.mockResolvedValue(updated);

    const result = await addressBookService.updateAddressService(ADDRESS_ID, updateDto, MERCHANT_ID);

    expect(addressBookRepository.update).toHaveBeenCalledWith(ADDRESS_ID, MERCHANT_ID, updateDto);
    expect(result.name).toBe('Jane Doe');
  });

  test('throws 404 when address not found', async () => {
    addressBookRepository.findById.mockResolvedValue(null);

    await expect(addressBookService.updateAddressService(ADDRESS_ID, updateDto, MERCHANT_ID))
      .rejects.toMatchObject({ message: 'Address not found', statusCode: 404 });
    expect(addressBookRepository.update).not.toHaveBeenCalled();
  });

  test('throws 500 when DB update returns null (concurrent delete race)', async () => {
    addressBookRepository.findById.mockResolvedValue(mockAddress);
    addressBookRepository.update.mockResolvedValue(null);

    await expect(addressBookService.updateAddressService(ADDRESS_ID, updateDto, MERCHANT_ID))
      .rejects.toMatchObject({ message: 'Failed to update address', statusCode: 500 });
  });

  test('includes updated field keys in log event (audit trail)', async () => {
    const logger = require('../../../src/utils/logger');
    const updated = { ...mockAddress, ...updateDto };
    addressBookRepository.findById.mockResolvedValue(mockAddress);
    addressBookRepository.update.mockResolvedValue(updated);

    await addressBookService.updateAddressService(ADDRESS_ID, updateDto, MERCHANT_ID);

    expect(logger.info).toHaveBeenCalledWith(
      'address_updated',
      expect.objectContaining({ updatedFields: expect.arrayContaining(['name', 'phone']) }),
    );
  });
});

// ─── deleteAddressService ──────────────────────────────────────────────────────

describe('deleteAddressService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('soft-deletes address and returns success message', async () => {
    const deleted = { ...mockAddress, deletedAt: new Date() };
    addressBookRepository.findById.mockResolvedValue(mockAddress);
    addressBookRepository.softDelete.mockResolvedValue(deleted);

    const result = await addressBookService.deleteAddressService(ADDRESS_ID, MERCHANT_ID);

    expect(addressBookRepository.softDelete).toHaveBeenCalledWith(ADDRESS_ID, MERCHANT_ID);
    expect(result).toEqual({ message: 'Address deleted successfully' });
  });

  test('throws 404 when address not found', async () => {
    addressBookRepository.findById.mockResolvedValue(null);

    await expect(addressBookService.deleteAddressService(ADDRESS_ID, MERCHANT_ID))
      .rejects.toMatchObject({ message: 'Address not found', statusCode: 404 });
    expect(addressBookRepository.softDelete).not.toHaveBeenCalled();
  });

  test('throws 500 when softDelete returns null (race condition)', async () => {
    addressBookRepository.findById.mockResolvedValue(mockAddress);
    addressBookRepository.softDelete.mockResolvedValue(null);

    await expect(addressBookService.deleteAddressService(ADDRESS_ID, MERCHANT_ID))
      .rejects.toMatchObject({ message: 'Failed to delete address', statusCode: 500 });
  });
});

// ─── markAddressUsedService ────────────────────────────────────────────────────

describe('markAddressUsedService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('marks address as used and logs the event', async () => {
    const logger = require('../../../src/utils/logger');
    const used = { ...mockAddress, lastUsedAt: new Date() };
    addressBookRepository.markAsUsed.mockResolvedValue(used);

    await addressBookService.markAddressUsedService(ADDRESS_ID, MERCHANT_ID);

    expect(addressBookRepository.markAsUsed).toHaveBeenCalledWith(ADDRESS_ID, MERCHANT_ID);
    expect(logger.info).toHaveBeenCalledWith(
      'address_marked_used',
      expect.objectContaining({ addressId: ADDRESS_ID }),
    );
  });

  test('resolves without throwing when address not found (null return)', async () => {
    addressBookRepository.markAsUsed.mockResolvedValue(null);

    await expect(addressBookService.markAddressUsedService(ADDRESS_ID, MERCHANT_ID))
      .resolves.toBeUndefined();
  });

  test('resolves without throwing when repository throws (fail-silently contract)', async () => {
    addressBookRepository.markAsUsed.mockRejectedValue(new Error('DB timeout'));

    await expect(addressBookService.markAddressUsedService(ADDRESS_ID, MERCHANT_ID))
      .resolves.toBeUndefined();
  });

  test('logs warning when repository throws', async () => {
    const logger = require('../../../src/utils/logger');
    addressBookRepository.markAsUsed.mockRejectedValue(new Error('Connection lost'));

    await addressBookService.markAddressUsedService(ADDRESS_ID, MERCHANT_ID);

    expect(logger.warn).toHaveBeenCalledWith(
      'address_mark_used_failed',
      expect.objectContaining({ error: 'Connection lost' }),
    );
  });
});
