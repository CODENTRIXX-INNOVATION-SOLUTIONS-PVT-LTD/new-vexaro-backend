'use strict';

jest.mock('../../../src/utils/velocity', () => ({
  velocityClient: {
    createReverseOrder: jest.fn(),
  },
}));

jest.mock('../../../src/modules/shipments/shipment.model', () => {
  const mockCreate = jest.fn().mockImplementation(async (data) => ({
    ...data,
    _id: 'new_ship_id_777',
    save: jest.fn().mockResolvedValue(true),
  }));
  return {
    Shipment: {
      findOne: jest.fn().mockResolvedValue(null),
      create: mockCreate,
      generateAWB: jest.fn().mockReturnValue('VX-REV-123456-ABC'),
    },
  };
});

jest.mock('../../../src/modules/users/warehouse.model', () => {
  return {
    Warehouse: {
      findById: jest.fn(),
      findOne: jest.fn(),
    },
  };
});

jest.mock('../../../src/modules/users/user.repository');
jest.mock('../../../src/modules/notifications/notification.service', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));

const { velocityClient } = require('../../../src/utils/velocity');
const { Shipment } = require('../../../src/modules/shipments/shipment.model');
const { Warehouse } = require('../../../src/modules/users/warehouse.model');
const userRepository = require('../../../src/modules/users/user.repository');
const { createReverseShipmentService } = require('../../../src/modules/shipments/services/shipment-reverse.service');
const { ShipmentStatus, UserRole } = require('../../../src/constants');

describe('Phase 7: Reverse Pickup / Returns Integration Tests', () => {
  let mockMerchant;
  let mockWarehouse;
  const caller = { userId: 'merchant123', role: UserRole.MERCHANT };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMerchant = {
      _id: 'merchant123',
      phone: '9876543210',
      invitedBy: 'distributor999',
    };
    mockWarehouse = {
      _id: 'warehouse123',
      warehouseId: 'WH001',
      velocityWarehouseId: 'vel-wh-xyz',
      contactPerson: 'Manager Name',
      phone: '8888888888',
      email: 'manager@wh.com',
      address: '123 Warehouse Rd',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      country: 'India',
    };

    userRepository.findOne.mockResolvedValue(mockMerchant);
    Warehouse.findById.mockResolvedValue(mockWarehouse);
    Warehouse.findOne.mockResolvedValue(mockWarehouse);
  });

  test('should successfully book reverse pickup and map correct DB properties', async () => {
    velocityClient.createReverseOrder.mockResolvedValue({
      awb: 'VEL-REV-AWB-888',
      carrierName: 'Velocity Air Express',
      carrierId: 'vol-express-01',
      shipmentId: 'vel-ship-999',
      velocityOrderId: 'vel-ord-777',
      returnId: 'vel-ret-555',
      labelUrl: 'https://vel.com/label.pdf',
      manifestUrl: 'https://vel.com/manifest.pdf',
      trackingUrl: 'https://vel.com/track/888',
      estimatedDelivery: '2026-07-15T18:00:00Z',
    });

    const dto = {
      warehouseId: 'warehouse123',
      orderId: 'RET-ORDER-001',
      pickupFirstName: 'John',
      pickupLastName: 'Doe',
      pickupPhone: '9999911111',
      pickupAddress: 'Customer Home address',
      pickupCity: 'Delhi',
      pickupState: 'Delhi',
      pickupPincode: '110002',
      pickupCountry: 'India',
      weight: 1.5,
      length: 15,
      breadth: 15,
      height: 15,
      subTotal: 500,
      totalDiscount: 50,
      paymentMethod: 'PREPAID',
      orderItems: [
        {
          name: 'Item A',
          sku: 'SKU-A',
          units: 2,
          selling_price: 250,
          discount: 25,
          tax: 12,
          qc_enable: false,
        },
      ],
    };

    const result = await createReverseShipmentService(dto, caller);

    expect(velocityClient.createReverseOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'RET-ORDER-001',
        paymentMethod: 'PREPAID',
      }),
      'vel-wh-xyz',
      ''
    );

    expect(Shipment.create).toHaveBeenCalled();
    expect(result.isReturn).toBe(true);
    expect(result.shipmentType).toBe('return');
    expect(result.carrierAWB).toBe('VEL-REV-AWB-888');
    expect(result.status).toBe(ShipmentStatus.ORDER_CREATED);
    expect(result.qcStatus).toBe('NOT_ELIGIBLE');
    expect(result.origin.name).toBe('John Doe');
    expect(result.destination.name).toBe('Manager Name');
  });

  test('should throw error if QC return has more than 2 items', async () => {
    const dto = {
      warehouseId: 'warehouse123',
      orderItems: [
        { name: 'Item 1', sku: 'S1', units: 1, selling_price: 100, qc_enable: true, qc_product_image: 'img.jpg' },
        { name: 'Item 2', sku: 'S2', units: 1, selling_price: 100, qc_enable: false },
        { name: 'Item 3', sku: 'S3', units: 1, selling_price: 100, qc_enable: false },
      ],
    };

    await expect(createReverseShipmentService(dto, caller)).rejects.toThrow(
      'QC return shipments cannot have more than 2 items. Remove QC flag or reduce item count.'
    );
  });

  test('should throw error if QC enabled but image is missing', async () => {
    const dto = {
      warehouseId: 'warehouse123',
      orderItems: [
        { name: 'Item 1', sku: 'S1', units: 1, selling_price: 100, qc_enable: true },
      ],
    };

    await expect(createReverseShipmentService(dto, caller)).rejects.toThrow(
      'QC is enabled for item "Item 1" but qc_product_image is missing. It is required for QC items.'
    );
  });

  test('should throw error if warehouse is not synced to Velocity', async () => {
    mockWarehouse.velocityWarehouseId = null;
    const dto = {
      warehouseId: 'warehouse123',
      orderItems: [{ name: 'Item 1', sku: 'S1', units: 1, selling_price: 100 }],
    };

    await expect(createReverseShipmentService(dto, caller)).rejects.toThrow(
      'Warehouse "WH001" has not been synced to Velocity. Contact your admin.'
    );
  });
});
