'use strict';

/**
 * Warehouse Profile Management Integration Tests (Task 11)
 * Tests full workflows for viewing, updating contact, requesting address changes,
 * approving, rejecting, and cancelling requests.
 */

const warehouseService = require('../../../src/modules/users/warehouse.service');
const warehouseChangeRequestService = require('../../../src/modules/users/warehouse-change-request.service');
const warehouseRepository = require('../../../src/modules/users/warehouse.repository');
const warehouseChangeRequestRepository = require('../../../src/modules/users/warehouse-change-request.repository');
const userRepository = require('../../../src/modules/users/user.repository');

jest.mock('../../../src/modules/users/warehouse.repository');
jest.mock('../../../src/modules/users/warehouse-change-request.repository');
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
  contactPerson: 'John Doe',
  phone: '9876543210',
  email: 'warehouse@example.com',
  address: '123 Initial St',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  country: 'India',
  isActive: true,
};

const mockMerchant = {
  _id: MERCHANT_ID,
  firstName: 'Merchant',
  lastName: 'User',
  email: 'merchant@example.com',
  invitedBy: { _id: DISTRIBUTOR_ID },
};

const mockDistributor = {
  _id: DISTRIBUTOR_ID,
  email: 'distributor@example.com',
};

describe('Warehouse Management Workflows (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Workflow 1: View Merchant Warehouses & Single Warehouse Profile', async () => {
    warehouseRepository.findAllByMerchantId.mockResolvedValue([mockWarehouse]);
    warehouseRepository.findById.mockResolvedValue(mockWarehouse);

    const list = await warehouseService.getWarehousesService(MERCHANT_ID);
    expect(list).toHaveLength(1);
    expect(list[0].warehouseId).toBe('WH1234MH');

    const single = await warehouseService.getWarehouseByIdService(WAREHOUSE_ID, MERCHANT_ID);
    expect(single.contactPerson).toBe('John Doe');
  });

  test('Workflow 2: Immediate Contact Information Update', async () => {
    const warehouseDoc = { ...mockWarehouse, save: jest.fn().mockResolvedValue(true) };
    warehouseRepository.findById.mockResolvedValue(warehouseDoc);

    const updateDto = { contactPerson: 'Jane Doe', phone: '9123456789' };
    const updated = await warehouseService.updateContactService(WAREHOUSE_ID, updateDto, MERCHANT_ID);

    expect(updated.contactPerson).toBe('Jane Doe');
    expect(updated.phone).toBe('9123456789');
    expect(warehouseRepository.save).toHaveBeenCalled();
  });

  test('Workflow 3: Full Address Change Approval Cycle', async () => {
    const changeRequestDoc = {
      _id: REQUEST_ID,
      warehouseId: WAREHOUSE_ID,
      merchantId: MERCHANT_ID,
      distributorId: DISTRIBUTOR_ID,
      status: 'PENDING',
      currentAddress: { addressLine: '123 Initial St', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', country: 'India' },
      requestedAddress: { addressLine: '456 Relocated Ave', city: 'Pune', state: 'Maharashtra', pincode: '411001', country: 'India' },
      save: jest.fn().mockResolvedValue(true),
    };

    warehouseRepository.findById.mockResolvedValue(mockWarehouse);
    warehouseChangeRequestRepository.findByWarehouse.mockResolvedValue([]);
    userRepository.findById.mockImplementation((id) => id === MERCHANT_ID ? Promise.resolve(mockMerchant) : Promise.resolve(mockDistributor));
    warehouseChangeRequestRepository.create.mockResolvedValue(changeRequestDoc);

    // 1. Merchant submits address change request
    const reqDto = { addressLine: '456 Relocated Ave', city: 'Pune', state: 'Maharashtra', pincode: '411001' };
    const createdReq = await warehouseChangeRequestService.createAddressChangeRequestService(WAREHOUSE_ID, reqDto, MERCHANT_ID);
    expect(createdReq.status).toBe('PENDING');

    // 2. Distributor approves address change request
    warehouseChangeRequestRepository.findById.mockResolvedValue(changeRequestDoc);
    warehouseRepository.updateAddress.mockResolvedValue({ ...mockWarehouse, address: '456 Relocated Ave', city: 'Pune', pincode: '411001' });

    const approvedReq = await warehouseChangeRequestService.approveAddressChangeRequestService(REQUEST_ID, DISTRIBUTOR_ID);
    expect(approvedReq.status).toBe('APPROVED');
    expect(warehouseRepository.updateAddress).toHaveBeenCalledWith(WAREHOUSE_ID, expect.objectContaining({ address: '456 Relocated Ave' }));
  });

  test('Workflow 4: Full Address Change Rejection Cycle', async () => {
    const changeRequestDoc = {
      _id: REQUEST_ID,
      warehouseId: WAREHOUSE_ID,
      merchantId: MERCHANT_ID,
      distributorId: DISTRIBUTOR_ID,
      status: 'PENDING',
      currentAddress: { addressLine: '123 Initial St', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', country: 'India' },
      requestedAddress: { addressLine: '999 Remote Rd', city: 'Remote', state: 'Maharashtra', pincode: '440001', country: 'India' },
      save: jest.fn().mockResolvedValue(true),
    };

    warehouseChangeRequestRepository.findById.mockResolvedValue(changeRequestDoc);

    const rejectedReq = await warehouseChangeRequestService.rejectAddressChangeRequestService(REQUEST_ID, 'Area unserviceable by top carriers', DISTRIBUTOR_ID);
    expect(rejectedReq.status).toBe('REJECTED');
    expect(rejectedReq.rejectionReason).toBe('Area unserviceable by top carriers');
    expect(warehouseRepository.updateAddress).not.toHaveBeenCalled();
  });

  test('Workflow 5: Address Change Cancellation by Merchant', async () => {
    const changeRequestDoc = {
      _id: REQUEST_ID,
      warehouseId: WAREHOUSE_ID,
      merchantId: MERCHANT_ID,
      distributorId: DISTRIBUTOR_ID,
      status: 'PENDING',
      save: jest.fn().mockResolvedValue(true),
    };

    warehouseChangeRequestRepository.findById.mockResolvedValue(changeRequestDoc);

    const cancelledReq = await warehouseChangeRequestService.cancelAddressChangeRequestService(REQUEST_ID, MERCHANT_ID);
    expect(cancelledReq.status).toBe('CANCELLED');
  });
});
