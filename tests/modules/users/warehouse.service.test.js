'use strict';

/**
 * Warehouse Service Unit Tests (Task 10)
 */

const {
  getWarehousesService,
  getWarehouseByIdService,
  updateContactService,
} = require('../../../src/modules/users/warehouse.service');
const warehouseRepository = require('../../../src/modules/users/warehouse.repository');
const { logAuditEvent } = require('../../../src/modules/audit/audit.service');

jest.mock('../../../src/modules/users/warehouse.repository');
jest.mock('../../../src/modules/audit/audit.service', () => ({
  logAuditEvent: jest.fn(),
}));

const MERCHANT_ID   = '507f1f77bcf86cd799439011';
const WAREHOUSE_ID  = '507f1f77bcf86cd799439040';
const OTHER_USER_ID = '507f1f77bcf86cd799439099';

const mockWarehouse = {
  _id: WAREHOUSE_ID,
  warehouseId: 'WH1234MH',
  merchantId: MERCHANT_ID,
  contactPerson: 'Old Contact',
  phone: '9876543210',
  email: 'old@example.com',
  address: '123 St',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  country: 'India',
  isActive: true,
};

describe('warehouse.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWarehousesService', () => {
    test('returns active warehouses for merchant', async () => {
      warehouseRepository.findAllByMerchantId.mockResolvedValue([mockWarehouse]);
      const res = await getWarehousesService(MERCHANT_ID);
      expect(warehouseRepository.findAllByMerchantId).toHaveBeenCalledWith(MERCHANT_ID);
      expect(res).toEqual([mockWarehouse]);
    });
  });

  describe('getWarehouseByIdService', () => {
    test('returns warehouse when owned by merchant', async () => {
      warehouseRepository.findById.mockResolvedValue(mockWarehouse);
      const res = await getWarehouseByIdService(WAREHOUSE_ID, MERCHANT_ID);
      expect(res).toEqual(mockWarehouse);
    });

    test('throws 404 when warehouse not found', async () => {
      warehouseRepository.findById.mockResolvedValue(null);
      await expect(getWarehouseByIdService(WAREHOUSE_ID, MERCHANT_ID))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    test('throws 403 when warehouse belongs to different merchant', async () => {
      warehouseRepository.findById.mockResolvedValue(mockWarehouse);
      await expect(getWarehouseByIdService(WAREHOUSE_ID, OTHER_USER_ID))
        .rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('updateContactService', () => {
    test('updates contact fields and logs audit event', async () => {
      const warehouseDoc = { ...mockWarehouse, save: jest.fn().mockResolvedValue(true) };
      warehouseRepository.findById.mockResolvedValue(warehouseDoc);

      const dto = { contactPerson: 'New Contact', phone: '9999999999' };
      const updated = await updateContactService(WAREHOUSE_ID, dto, MERCHANT_ID);

      expect(updated.contactPerson).toBe('New Contact');
      expect(updated.phone).toBe('9999999999');
      expect(warehouseRepository.save).toHaveBeenCalled();
      expect(logAuditEvent).toHaveBeenCalledWith(
        MERCHANT_ID,
        'WAREHOUSE_CONTACT_UPDATED',
        expect.objectContaining({ updatedFields: expect.arrayContaining(['contactPerson', 'phone']) }),
        warehouseDoc._id,
      );
    });

    test('throws 404 when warehouse not found', async () => {
      warehouseRepository.findById.mockResolvedValue(null);
      await expect(updateContactService(WAREHOUSE_ID, {}, MERCHANT_ID))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    test('throws 403 when user does not own warehouse', async () => {
      warehouseRepository.findById.mockResolvedValue(mockWarehouse);
      await expect(updateContactService(WAREHOUSE_ID, {}, OTHER_USER_ID))
        .rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
