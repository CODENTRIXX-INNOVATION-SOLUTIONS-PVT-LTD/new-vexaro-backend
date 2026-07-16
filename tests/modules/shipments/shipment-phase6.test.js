'use strict';

jest.mock('../../../src/utils/velocity', () => ({
  velocityClient: {
    cancelOrders: jest.fn(),
    reattemptDelivery: jest.fn(),
    initiateRto: jest.fn(),
  },
}));

jest.mock('../../../src/modules/shipments/shipment.model', () => {
  return {
    Shipment: {
      findOne: jest.fn(),
    },
  };
});

jest.mock('../../../src/modules/users/user.repository');
jest.mock('../../../src/modules/users/user.model', () => ({
  User: { findOne: jest.fn() },
}));
jest.mock('../../../src/utils/transaction', () => ({
  runInTransaction: jest.fn().mockImplementation(async (fn) => fn({})),
}));
jest.mock('../../../src/modules/finance/finance.service', () => ({
  applyTransaction: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../src/modules/notifications/notification.service', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../src/modules/audit/audit.service', () => ({
  logAuditEvent: jest.fn(),
}));
jest.mock('../../../src/utils/cache', () => ({
  del: jest.fn(),
  KEYS: {
    shipmentStats: jest.fn().mockReturnValue('key'),
  },
}));
jest.mock('../../../src/modules/shipments/shared/shipment.helpers', () => ({
  findShipmentWithAccess: jest.fn(),
}));

const { velocityClient } = require('../../../src/utils/velocity');
const { Shipment } = require('../../../src/modules/shipments/shipment.model');
const { User } = require('../../../src/modules/users/user.model');
const { findShipmentWithAccess } = require('../../../src/modules/shipments/shared/shipment.helpers');
const { applyTransaction } = require('../../../src/modules/finance/finance.service');
const { deleteShipmentService } = require('../../../src/modules/shipments/services/shipment-delete.service');
const {
  reattemptVelocityDeliveryService,
  initiateVelocityRtoService,
} = require('../../../src/modules/shipments/services/shipment-velocity.service');
const { ShipmentStatus, TransactionType } = require('../../../src/constants');

describe('Phase 6: Cancellation / NDR / RTO Integration Tests', () => {
  let mockShipment;
  const caller = { userId: 'user123', role: 'MERCHANT' };

  beforeEach(() => {
    jest.clearAllMocks();
    User.findOne.mockResolvedValue({
      _id: { toString: () => 'superadmin123' },
      role: 'SUPER_ADMIN',
      isActive: true,
      deletedAt: null,
    });
    mockShipment = {
      _id: 'ship123',
      awb: 'VX-123456-ABCDEF',
      carrierAWB: '9999999999',
      status: 'ORDER_CREATED',
      statusHistory: [],
      merchantCost: 100,
      distributorCost: 80,
      vexaroProfit: 20,
      distributorProfit: 20,
      velocityBooked: true,
      merchantId: 'user123',
      distributorId: 'dist123',
      destination: {
        addressLine: 'Original Address',
        phone: '9876543210',
        landmark: null,
      },
      save: jest.fn().mockImplementation(function () { return Promise.resolve(this); }),
    };
  });

  describe('Confirm cancel shipment uses Velocity cancel-order', () => {
    test('should successfully cancel order via Velocity and update local state', async () => {
      findShipmentWithAccess.mockResolvedValue(mockShipment);
      velocityClient.cancelOrders.mockResolvedValue('Cancellation request submitted');

      const result = await deleteShipmentService('ship123', caller);

      expect(velocityClient.cancelOrders).toHaveBeenCalledWith(['9999999999']);
      expect(mockShipment.status).toBe(ShipmentStatus.CANCELLED);
      expect(mockShipment.cancellationResult).toBe('Cancellation request submitted');
      expect(mockShipment.statusHistory).toContainEqual(
        expect.objectContaining({
          status: ShipmentStatus.CANCELLED,
          note: expect.stringContaining('Cancellation request submitted'),
        })
      );
      expect(applyTransaction).toHaveBeenCalledWith(
        {},
        'user123',
        TransactionType.REFUND,
        100,
        expect.objectContaining({
          reference: 'REFUND-VX-123456-ABCDEF-MERCH',
        }),
      );
      expect(applyTransaction).toHaveBeenCalledWith(
        {},
        'superadmin123',
        TransactionType.DEBIT,
        80,
        expect.objectContaining({
          reference: 'DEBIT-VX-123456-ABCDEF-SUPER-ADMIN-CANCEL',
        }),
      );
      expect(applyTransaction).toHaveBeenCalledWith(
        {},
        'dist123',
        TransactionType.DEBIT,
        20,
        expect.objectContaining({
          reference: 'DEBIT-VX-123456-ABCDEF-DIST-MARGIN-CANCEL',
        }),
      );
      expect(applyTransaction).not.toHaveBeenCalledWith(
        {},
        'dist123',
        TransactionType.REFUND,
        80,
        expect.any(Object),
      );
      expect(result.message).toBe('Shipment cancelled successfully.');
    });

    test('should fail cancellation if shipment is not in ORDER_CREATED status', async () => {
      mockShipment.status = ShipmentStatus.PICKED_UP;
      findShipmentWithAccess.mockResolvedValue(mockShipment);

      await expect(deleteShipmentService('ship123', caller)).rejects.toThrow(
        'Cancellation is only allowed when status is ORDER_CREATED.'
      );
      expect(velocityClient.cancelOrders).not.toHaveBeenCalled();
    });
  });

  describe('NDR Reattempt Delivery', () => {
    test('should successfully request reattempt via Velocity and update destination fields', async () => {
      Shipment.findOne.mockResolvedValue(mockShipment);
      velocityClient.reattemptDelivery.mockResolvedValue({ status: 1 });

      const dto = {
        awb: 'VX-123456-ABCDEF',
        updated_address: {
          address_line: 'New Address Line 1',
          landmark: 'Near Mall',
        },
        updated_phone_number: '9988776655',
        comments: 'Deliver tomorrow',
      };

      mockShipment.status = ShipmentStatus.DELIVERY_FAILED;

      const result = await reattemptVelocityDeliveryService(dto, caller);

      expect(velocityClient.reattemptDelivery).toHaveBeenCalledWith({
        ...dto,
        awb: '9999999999',
      });
      expect(mockShipment.destination.addressLine).toBe('New Address Line 1');
      expect(mockShipment.destination.landmark).toBe('Near Mall');
      expect(mockShipment.destination.phone).toBe('9988776655');
      expect(mockShipment.status).toBe(ShipmentStatus.OUT_FOR_DELIVERY);
      expect(mockShipment.subStatus).toBe('reattempt_delivery');
      expect(mockShipment.statusHistory).toContainEqual(
        expect.objectContaining({
          status: ShipmentStatus.OUT_FOR_DELIVERY,
          note: expect.stringContaining('Comments: Deliver tomorrow'),
        })
      );
      expect(result.velocityResult).toEqual({ status: 1 });
    });
  });

  describe('RTO Initiation', () => {
    test('should successfully initiate RTO via Velocity and update status', async () => {
      Shipment.findOne.mockResolvedValue(mockShipment);
      velocityClient.initiateRto.mockResolvedValue({ status: 1 });

      const dto = { awb: 'VX-123456-ABCDEF' };
      mockShipment.status = ShipmentStatus.DELIVERY_FAILED;

      const result = await initiateVelocityRtoService(dto, caller);

      expect(velocityClient.initiateRto).toHaveBeenCalledWith('9999999999');
      expect(mockShipment.status).toBe(ShipmentStatus.RTO);
      expect(mockShipment.subStatus).toBe('rto_initiated');
      expect(mockShipment.shipmentType).toBe('rto');
      expect(mockShipment.statusHistory).toContainEqual(
        expect.objectContaining({
          status: ShipmentStatus.RTO,
          note: 'Velocity RTO initiated by user.',
        })
      );
      expect(result.velocityResult).toEqual({ status: 1 });
    });
  });
});
