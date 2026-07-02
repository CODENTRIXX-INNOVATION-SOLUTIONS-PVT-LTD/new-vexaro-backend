/**
 * AddressBook Service Unit Tests
 * 
 * Comprehensive test suite for address book service layer
 * Tests business logic, validation, error handling, and edge cases
 */

const addressBookService = require('../address-book.service');
const addressBookRepository = require('../address-book.repository');
const userRepository = require('../user.repository');
const { UserRole } = require('../../../constants');

// Mock dependencies
jest.mock('../address-book.repository');
jest.mock('../user.repository');
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('AddressBook Service', () => {
  // Mock merchant user
  const mockMerchant = {
    _id: '507f1f77bcf86cd799439011',
    email: 'merchant@example.com',
    role: UserRole.MERCHANT,
    isActive: true,
    deletedAt: null,
  };

  const mockAddress = {
    _id: '507f1f77bcf86cd799439012',
    merchantId: mockMerchant._id,
    name: 'John Doe',
    phone: '9876543210',
    email: 'john@example.com',
    addressLine: '123 Main Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    country: 'India',
    label: 'Store',
    lastUsedAt: null,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAddressService', () => {
    const createDto = {
      name: 'John Doe',
      phone: '9876543210',
      email: 'john@example.com',
      addressLine: '123 Main Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      country: 'India',
      label: 'Store',
    };

    test('should create address successfully', async () => {
      userRepository.findById.mockResolvedValue(mockMerchant);
      addressBookRepository.create.mockResolvedValue(mockAddress);

      const result = await addressBookService.createAddressService(createDto, mockMerchant._id);

      expect(userRepository.findById).toHaveBeenCalledWith(mockMerchant._id);
      expect(addressBookRepository.create).toHaveBeenCalledWith({
        ...createDto,
        merchantId: mockMerchant._id,
      });
      expect(result).toEqual(mockAddress);
    });

    test('should throw 403 if merchant not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(
        addressBookService.createAddressService(createDto, mockMerchant._id)
      ).rejects.toMatchObject({
        message: 'Merchant not found',
        statusCode: 403,
      });
    });

    test('should throw 403 if merchant is not active', async () => {
      userRepository.findById.mockResolvedValue({
        ...mockMerchant,
        isActive: false,
      });

      await expect(
        addressBookService.createAddressService(createDto, mockMerchant._id)
      ).rejects.toMatchObject({
        message: 'Merchant account is not active',
        statusCode: 403,
      });
    });

    test('should throw 403 if user is not a merchant', async () => {
      userRepository.findById.mockResolvedValue({
        ...mockMerchant,
        role: UserRole.DISTRIBUTOR,
      });

      await expect(
        addressBookService.createAddressService(createDto, mockMerchant._id)
      ).rejects.toMatchObject({
        message: 'Only merchants can manage address book',
        statusCode: 403,
      });
    });

    test('should throw 403 if merchant is deleted', async () => {
      userRepository.findById.mockResolvedValue({
        ...mockMerchant,
        deletedAt: new Date(),
      });

      await expect(
        addressBookService.createAddressService(createDto, mockMerchant._id)
      ).rejects.toMatchObject({
        message: 'Merchant not found',
        statusCode: 403,
      });
    });
  });

  describe('listAddressesService', () => {
    test('should list addresses with default pagination', async () => {
      userRepository.findById.mockResolvedValue(mockMerchant);
      addressBookRepository.findByMerchant.mockResolvedValue([mockAddress]);
      addressBookRepository.countByMerchant.mockResolvedValue(1);

      const result = await addressBookService.listAddressesService({}, mockMerchant._id);

      expect(result).toEqual({
        addresses: [mockAddress],
        pagination: {
          total: 1,
          page: 1,
          pageSize: 20,
          pages: 1,
        },
      });
    });

    test('should list addresses with custom pagination', async () => {
      userRepository.findById.mockResolvedValue(mockMerchant);
      addressBookRepository.findByMerchant.mockResolvedValue([mockAddress]);
      addressBookRepository.countByMerchant.mockResolvedValue(50);

      const result = await addressBookService.listAddressesService(
        { page: 2, pageSize: 10 },
        mockMerchant._id
      );

      expect(result.pagination).toEqual({
        total: 50,
        page: 2,
        pageSize: 10,
        pages: 5,
      });
      expect(addressBookRepository.findByMerchant).toHaveBeenCalledWith(
        mockMerchant._id,
        {},
        { skip: 10, limit: 10, sort: { lastUsedAt: -1, createdAt: -1 } }
      );
    });

    test('should filter by label', async () => {
      userRepository.findById.mockResolvedValue(mockMerchant);
      addressBookRepository.findByMerchant.mockResolvedValue([mockAddress]);
      addressBookRepository.countByMerchant.mockResolvedValue(1);

      await addressBookService.listAddressesService(
        { label: 'Store' },
        mockMerchant._id
      );

      expect(addressBookRepository.findByMerchant).toHaveBeenCalledWith(
        mockMerchant._id,
        { label: 'Store' },
        expect.any(Object)
      );
    });

    test('should filter by search term', async () => {
      userRepository.findById.mockResolvedValue(mockMerchant);
      addressBookRepository.findByMerchant.mockResolvedValue([mockAddress]);
      addressBookRepository.countByMerchant.mockResolvedValue(1);

      await addressBookService.listAddressesService(
        { search: 'john' },
        mockMerchant._id
      );

      expect(addressBookRepository.findByMerchant).toHaveBeenCalledWith(
        mockMerchant._id,
        {
          $or: [
            { name: { $regex: 'john', $options: 'i' } },
            { phone: { $regex: 'john', $options: 'i' } },
            { email: { $regex: 'john', $options: 'i' } },
            { city: { $regex: 'john', $options: 'i' } },
          ],
        },
        expect.any(Object)
      );
    });

    test('should sort addresses with lastUsedAt DESC NULLS LAST', async () => {
      const recentlyUsedAddress = {
        ...mockAddress,
        _id: '1',
        lastUsedAt: new Date('2024-02-01'),
        createdAt: new Date('2024-01-01'),
      };
      const olderUsedAddress = {
        ...mockAddress,
        _id: '2',
        lastUsedAt: new Date('2024-01-15'),
        createdAt: new Date('2024-01-01'),
      };
      const neverUsedNewerAddress = {
        ...mockAddress,
        _id: '3',
        lastUsedAt: null,
        createdAt: new Date('2024-01-20'),
      };
      const neverUsedOlderAddress = {
        ...mockAddress,
        _id: '4',
        lastUsedAt: null,
        createdAt: new Date('2024-01-10'),
      };

      userRepository.findById.mockResolvedValue(mockMerchant);
      addressBookRepository.findByMerchant.mockResolvedValue([
        neverUsedOlderAddress,
        recentlyUsedAddress,
        neverUsedNewerAddress,
        olderUsedAddress,
      ]);
      addressBookRepository.countByMerchant.mockResolvedValue(4);

      const result = await addressBookService.listAddressesService({}, mockMerchant._id);

      // Expected order:
      // 1. recentlyUsedAddress (lastUsedAt: 2024-02-01)
      // 2. olderUsedAddress (lastUsedAt: 2024-01-15)
      // 3. neverUsedNewerAddress (null lastUsedAt, createdAt: 2024-01-20)
      // 4. neverUsedOlderAddress (null lastUsedAt, createdAt: 2024-01-10)
      expect(result.addresses[0]._id).toBe('1');
      expect(result.addresses[1]._id).toBe('2');
      expect(result.addresses[2]._id).toBe('3');
      expect(result.addresses[3]._id).toBe('4');
    });
  });

  describe('getAddressByIdService', () => {
    test('should get address by ID successfully', async () => {
      addressBookRepository.findById.mockResolvedValue(mockAddress);

      const result = await addressBookService.getAddressByIdService(
        mockAddress._id,
        mockMerchant._id
      );

      expect(addressBookRepository.findById).toHaveBeenCalledWith(
        mockAddress._id,
        mockMerchant._id
      );
      expect(result).toEqual(mockAddress);
    });

    test('should throw 404 if address not found', async () => {
      addressBookRepository.findById.mockResolvedValue(null);

      await expect(
        addressBookService.getAddressByIdService(mockAddress._id, mockMerchant._id)
      ).rejects.toMatchObject({
        message: 'Address not found',
        statusCode: 404,
      });
    });
  });

  describe('updateAddressService', () => {
    const updateDto = {
      name: 'Jane Doe',
      phone: '9876543211',
    };

    test('should update address successfully', async () => {
      const updatedAddress = { ...mockAddress, ...updateDto };
      addressBookRepository.findById.mockResolvedValue(mockAddress);
      addressBookRepository.update.mockResolvedValue(updatedAddress);

      const result = await addressBookService.updateAddressService(
        mockAddress._id,
        updateDto,
        mockMerchant._id
      );

      expect(addressBookRepository.findById).toHaveBeenCalledWith(
        mockAddress._id,
        mockMerchant._id
      );
      expect(addressBookRepository.update).toHaveBeenCalledWith(
        mockAddress._id,
        mockMerchant._id,
        updateDto
      );
      expect(result).toEqual(updatedAddress);
    });

    test('should throw 404 if address not found', async () => {
      addressBookRepository.findById.mockResolvedValue(null);

      await expect(
        addressBookService.updateAddressService(
          mockAddress._id,
          updateDto,
          mockMerchant._id
        )
      ).rejects.toMatchObject({
        message: 'Address not found',
        statusCode: 404,
      });
    });

    test('should throw 500 if update fails', async () => {
      addressBookRepository.findById.mockResolvedValue(mockAddress);
      addressBookRepository.update.mockResolvedValue(null);

      await expect(
        addressBookService.updateAddressService(
          mockAddress._id,
          updateDto,
          mockMerchant._id
        )
      ).rejects.toMatchObject({
        message: 'Failed to update address',
        statusCode: 500,
      });
    });
  });

  describe('deleteAddressService', () => {
    test('should soft delete address successfully', async () => {
      const deletedAddress = { ...mockAddress, deletedAt: new Date() };
      addressBookRepository.findById.mockResolvedValue(mockAddress);
      addressBookRepository.softDelete.mockResolvedValue(deletedAddress);

      const result = await addressBookService.deleteAddressService(
        mockAddress._id,
        mockMerchant._id
      );

      expect(addressBookRepository.findById).toHaveBeenCalledWith(
        mockAddress._id,
        mockMerchant._id
      );
      expect(addressBookRepository.softDelete).toHaveBeenCalledWith(
        mockAddress._id,
        mockMerchant._id
      );
      expect(result).toEqual({ message: 'Address deleted successfully' });
    });

    test('should throw 404 if address not found', async () => {
      addressBookRepository.findById.mockResolvedValue(null);

      await expect(
        addressBookService.deleteAddressService(mockAddress._id, mockMerchant._id)
      ).rejects.toMatchObject({
        message: 'Address not found',
        statusCode: 404,
      });
    });

    test('should throw 500 if delete fails', async () => {
      addressBookRepository.findById.mockResolvedValue(mockAddress);
      addressBookRepository.softDelete.mockResolvedValue(null);

      await expect(
        addressBookService.deleteAddressService(mockAddress._id, mockMerchant._id)
      ).rejects.toMatchObject({
        message: 'Failed to delete address',
        statusCode: 500,
      });
    });
  });

  describe('markAddressUsedService', () => {
    test('should mark address as used successfully', async () => {
      const usedAddress = { ...mockAddress, lastUsedAt: new Date() };
      addressBookRepository.markAsUsed.mockResolvedValue(usedAddress);

      await addressBookService.markAddressUsedService(
        mockAddress._id,
        mockMerchant._id
      );

      expect(addressBookRepository.markAsUsed).toHaveBeenCalledWith(
        mockAddress._id,
        mockMerchant._id
      );
    });

    test('should fail silently if address not found', async () => {
      addressBookRepository.markAsUsed.mockResolvedValue(null);

      // Should not throw error
      await expect(
        addressBookService.markAddressUsedService(mockAddress._id, mockMerchant._id)
      ).resolves.toBeUndefined();
    });

    test('should fail silently if repository throws error', async () => {
      addressBookRepository.markAsUsed.mockRejectedValue(new Error('DB error'));

      // Should not throw error
      await expect(
        addressBookService.markAddressUsedService(mockAddress._id, mockMerchant._id)
      ).resolves.toBeUndefined();
    });
  });
});
