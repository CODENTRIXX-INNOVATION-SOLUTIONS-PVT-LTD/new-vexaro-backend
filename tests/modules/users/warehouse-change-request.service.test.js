'use strict';

/**
 * WarehouseChangeRequest Service Unit Tests (Task 10)
 */

const {
  createAddressChangeRequestService,
  listChangeRequestsService,
  approveAddressChangeRequestService,
  rejectAddressChangeRequestService,
  cancelAddressChangeRequestService,
} = require('../../../src/modules/users/warehouse-change-request.service');
const warehouseChangeRequestRepository = require('../../../src/modules/users/warehouse-change-request.repository');
const warehouseRepository = require('../../../src/modules/users/warehouse.repository');
const userRepository = require('../../../src/modules/users/user.repository');
const { createNotification } = require('../../../src/modules/notifications/notification.service');
const { logAuditEvent } = require('../../../src/modules/audit/audit.service');
const { UserRole } = require('../../../src/constants');

jest.mock('../../../src/modules/users/warehouse-change-request.repository');
jest.mock('../../../src/modules/users/warehouse.repository');
jest.mock('../../../src/modules/users/user.repository');
jest.mock('../../../src/modules/notifications/notification.service', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../src/modules/audit/audit.service', () => ({
  logAuditEvent: jest.fn(),
}));
jest.mock('../../../src/utils/email', () => ({
  sendWarehouseChangeRequestEmail: jest.fn().mockResolvedValue({}),
  sendWarehouseChangeApprovedEmail: jest.fn().mockResolvedValue({}),
  sendWarehouseChangeRejectedEmail: jest.fn().mockResolvedValue({}),
}));

const MERCHANT_ID    = '507f1f77bcf86cd799439011';
const DISTRIBUTOR_ID = '507f1f77bcf86cd799439022';
const WAREHOUSE_ID   = '507f1f77bcf86cd799439040';
const REQUEST_ID     = '507f1f77bcf86cd799439050';

const mockWarehouse = {
  _id: WAREHOUSE_ID,
  warehouseId: 'WH1234MH',
  merchantId: MERCHANT_ID,
  address: 'Old St',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  country: 'India',
};

const mockMerchant = {
  _id: MERCHANT_ID,
  firstName: 'John',
  lastName: 'Merchant',
  email: 'merchant@example.com',
  invitedBy: { _id: DISTRIBUTOR_ID, email: 'distributor@example.com' },
};

const mockDistributor = {
  _id: DISTRIBUTOR_ID,
  email: 'distributor@example.com',
};

const mockRequest = {
  _id: REQUEST_ID,
  warehouseId: WAREHOUSE_ID,
  merchantId: MERCHANT_ID,
  distributorId: DISTRIBUTOR_ID,
  status: 'PENDING',
  currentAddress: { addressLine: 'Old St', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', country: 'India' },
  requestedAddress: { addressLine: 'New St', city: 'Pune', state: 'Maharashtra', pincode: '411001', country: 'India' },
  save: jest.fn().mockResolvedValue(true),
};

describe('warehouse-change-request.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAddressChangeRequestService', () => {
    test('creates address change request when valid', async () => {
      warehouseRepository.findById.mockResolvedValue(mockWarehouse);
      warehouseChangeRequestRepository.findByWarehouse.mockResolvedValue([]); // no pending
      userRepository.findById.mockImplementation((id) => {
        if (id === MERCHANT_ID) return Promise.resolve(mockMerchant);
        if (id === DISTRIBUTOR_ID) return Promise.resolve(mockDistributor);
        return Promise.resolve(null);
      });
      warehouseChangeRequestRepository.create.mockResolvedValue(mockRequest);

      const dto = { addressLine: 'New St', city: 'Pune', state: 'Maharashtra', pincode: '411001' };
      const res = await createAddressChangeRequestService(WAREHOUSE_ID, dto, MERCHANT_ID);

      expect(res).toEqual(mockRequest);
      expect(createNotification).toHaveBeenCalledWith(
        DISTRIBUTOR_ID,
        expect.objectContaining({ title: 'New Warehouse Address Change Request' }),
      );
    });

    test('throws 409 when pending request already exists', async () => {
      warehouseRepository.findById.mockResolvedValue(mockWarehouse);
      warehouseChangeRequestRepository.findByWarehouse.mockResolvedValue([mockRequest]);

      const dto = { addressLine: 'New St', city: 'Pune', state: 'Maharashtra', pincode: '411001' };
      await expect(createAddressChangeRequestService(WAREHOUSE_ID, dto, MERCHANT_ID))
        .rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('listChangeRequestsService', () => {
    test('lists requests for distributor with pagination', async () => {
      warehouseChangeRequestRepository.findByDistributor.mockResolvedValue([[mockRequest], 1]);

      const res = await listChangeRequestsService({ page: '1', pageSize: '10' }, DISTRIBUTOR_ID, UserRole.DISTRIBUTOR);
      expect(res.requests).toHaveLength(1);
      expect(res.pagination.total).toBe(1);
    });
  });

  describe('approveAddressChangeRequestService', () => {
    test('approves pending request and updates warehouse address', async () => {
      const reqDoc = { ...mockRequest, save: jest.fn().mockResolvedValue(true) };
      warehouseChangeRequestRepository.findById.mockResolvedValue(reqDoc);
      warehouseRepository.updateAddress.mockResolvedValue(true);
      userRepository.findById.mockResolvedValue(mockMerchant);
      warehouseRepository.findById.mockResolvedValue(mockWarehouse);

      const res = await approveAddressChangeRequestService(REQUEST_ID, DISTRIBUTOR_ID);

      expect(res.status).toBe('APPROVED');
      expect(warehouseRepository.updateAddress).toHaveBeenCalledWith(WAREHOUSE_ID, expect.objectContaining({ address: 'New St' }));
      expect(createNotification).toHaveBeenCalledWith(MERCHANT_ID, expect.objectContaining({ title: 'Warehouse Address Change Approved' }));
    });

    test('throws 409 if request is not pending', async () => {
      warehouseChangeRequestRepository.findById.mockResolvedValue({ ...mockRequest, status: 'APPROVED' });
      await expect(approveAddressChangeRequestService(REQUEST_ID, DISTRIBUTOR_ID))
        .rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('rejectAddressChangeRequestService', () => {
    test('rejects pending request with reason', async () => {
      const reqDoc = { ...mockRequest, save: jest.fn().mockResolvedValue(true) };
      warehouseChangeRequestRepository.findById.mockResolvedValue(reqDoc);
      userRepository.findById.mockResolvedValue(mockMerchant);
      warehouseRepository.findById.mockResolvedValue(mockWarehouse);

      const res = await rejectAddressChangeRequestService(REQUEST_ID, 'Serviceability issue', DISTRIBUTOR_ID);

      expect(res.status).toBe('REJECTED');
      expect(res.rejectionReason).toBe('Serviceability issue');
    });
  });

  describe('cancelAddressChangeRequestService', () => {
    test('cancels pending request for merchant owner', async () => {
      const reqDoc = { ...mockRequest, save: jest.fn().mockResolvedValue(true) };
      warehouseChangeRequestRepository.findById.mockResolvedValue(reqDoc);

      const res = await cancelAddressChangeRequestService(REQUEST_ID, MERCHANT_ID);

      expect(res.status).toBe('CANCELLED');
    });
  });
});
