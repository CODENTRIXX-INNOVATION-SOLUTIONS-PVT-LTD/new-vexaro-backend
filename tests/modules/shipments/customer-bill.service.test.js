'use strict';

jest.mock('../../../src/modules/shipments/shipment.model', () => ({
  Shipment: { findOne: jest.fn() },
}));
jest.mock('../../../src/modules/users/user.model', () => ({
  User: { findById: jest.fn() },
}));
jest.mock('../../../src/modules/users/warehouse.model', () => ({
  Warehouse: { findOne: jest.fn() },
}));

const { Shipment } = require('../../../src/modules/shipments/shipment.model');
const { User } = require('../../../src/modules/users/user.model');
const { Warehouse } = require('../../../src/modules/users/warehouse.model');
const { generateCustomerBillService, getCustomerBillSummaryService } = require('../../../src/modules/shipments/services/customer-bill.service');

const merchant = { role: 'MERCHANT', userId: 'merchant-1' };
const sampleShipment = {
  awb: 'VX-20260722-TEST01',
  carrierAWB: '7D130940446',
  merchantOrderRef: 'VX-ORD-TEST01',
  merchantCost: 35,
  merchantMarkup: 15,
  subTotal: 100,
  declaredValue: 100,
  destination: { name: 'Customer', phone: '9876543210', addressLine: 'Test address', city: 'Bhopal', state: 'Madhya Pradesh', pincode: '462010' },
  orderItems: [{ productName: 'Product X', sku: 'SKU-1', quantity: 1, sellingPrice: 100, discount: 0, tax: 0 }],
  merchantId: 'merchant-1', warehouseId: 'warehouse-1', createdAt: new Date('2026-07-22T07:27:00Z'), paymentMethod: 'PREPAID',
};

describe('generateCustomerBillService', () => {
  test('rejects super admin and distributor access before querying the shipment', async () => {
    await expect(generateCustomerBillService('shipment-1', { role: 'SUPER_ADMIN', userId: 'admin-1' }))
      .rejects.toMatchObject({ statusCode: 403 });
    await expect(generateCustomerBillService('shipment-1', { role: 'DISTRIBUTOR', userId: 'dist-1' }))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(Shipment.findOne).not.toHaveBeenCalled();
  });

  test('scopes the query to the owning merchant and returns a PDF', async () => {
    const lean = jest.fn().mockResolvedValue(sampleShipment);
    const select = jest.fn().mockReturnValue({ lean });
    Shipment.findOne.mockReturnValue({ select });
    User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ companyName: 'Test Merchant', address: 'Registered address' }) }) });
    Warehouse.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ gstNo: '23ABCDE1234F1Z5' }) });

    const result = await generateCustomerBillService('shipment-1', merchant);

    expect(Shipment.findOne).toHaveBeenCalledWith({
      _id: 'shipment-1', merchantId: 'merchant-1', deletedAt: null,
    });
    expect(select).toHaveBeenCalledWith('+merchantMarkup');
    expect(result.filename).toBe('customer-bill-VX-20260722-TEST01.pdf');
    expect(result.buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  test('does not reveal whether another merchant owns the shipment', async () => {
    const lean = jest.fn().mockResolvedValue(null);
    Shipment.findOne.mockReturnValue({ select: jest.fn().mockReturnValue({ lean }) });
    await expect(generateCustomerBillService('shipment-2', merchant)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('returns the private calculation only through the owner-scoped service', async () => {
    const lean = jest.fn().mockResolvedValue(sampleShipment);
    Shipment.findOne.mockReturnValue({ select: jest.fn().mockReturnValue({ lean }) });

    await expect(getCustomerBillSummaryService('shipment-1', merchant)).resolves.toEqual({
      productAmount: 100,
      shippingCost: 35,
      merchantMarkup: 15,
      deliveryCharge: 50,
      totalPayable: 150,
    });
  });

  test('still generates for existing merchants with incomplete optional business details', async () => {
    const shipmentWithOrigin = { ...sampleShipment, origin: { addressLine: 'Pickup address', city: 'Bhopal', state: 'Madhya Pradesh', pincode: '462023' } };
    Shipment.findOne.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(shipmentWithOrigin) }) });
    User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ firstName: 'Existing', lastName: 'Merchant' }) }) });
    Warehouse.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const result = await generateCustomerBillService('shipment-1', merchant);
    expect(result.buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
