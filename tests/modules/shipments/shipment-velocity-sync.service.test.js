'use strict';

jest.mock('../../../src/utils/velocity', () => ({
  velocityClient: { getTrackingDetails: jest.fn() },
}));
jest.mock('../../../src/modules/shipments/services/shipment-webhook.service', () => ({
  updateShipmentStatusFromVelocityWebhook: jest.fn(),
}));

const { ShipmentStatus } = require('../../../src/constants');
const { velocityClient } = require('../../../src/utils/velocity');
const {
  updateShipmentStatusFromVelocityWebhook,
} = require('../../../src/modules/shipments/services/shipment-webhook.service');
const {
  getTrackingStatus,
  syncListedShipmentsFromVelocity,
} = require('../../../src/modules/shipments/services/shipment-velocity-sync.service');

describe('shipment Velocity list reconciliation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('extracts the latest status from common Velocity tracking shapes', () => {
    expect(getTrackingStatus({ shipment_status: 'cancelled' })).toBe('cancelled');
    expect(getTrackingStatus({ tracking_data: [{ status: 'booked' }, { status: 'cancelled' }] }))
      .toBe('cancelled');
  });

  test('updates a visible active shipment when Velocity reports cancellation', async () => {
    const shipment = {
      velocityBooked: true,
      carrierAWB: '7D130940626',
      status: ShipmentStatus.ORDER_CREATED,
      statusHistory: [],
    };
    velocityClient.getTrackingDetails.mockResolvedValue({
      '7D130940626': { current_status: 'cancelled', sub_status: 'Cancelled by client' },
    });
    updateShipmentStatusFromVelocityWebhook.mockResolvedValue({
      status: ShipmentStatus.CANCELLED,
      subStatus: 'Cancelled by client',
      statusHistory: [{ status: ShipmentStatus.CANCELLED }],
    });

    await syncListedShipmentsFromVelocity([shipment]);

    expect(updateShipmentStatusFromVelocityWebhook).toHaveBeenCalledWith(expect.objectContaining({
      awb: '7D130940626',
      event: 'cancelled',
    }));
    expect(shipment.status).toBe(ShipmentStatus.CANCELLED);
  });

  test('does not call Velocity for terminal or non-Velocity shipments', async () => {
    await syncListedShipmentsFromVelocity([
      { velocityBooked: true, carrierAWB: 'A1', status: ShipmentStatus.CANCELLED },
      { velocityBooked: false, carrierAWB: 'A2', status: ShipmentStatus.ORDER_CREATED },
    ]);

    expect(velocityClient.getTrackingDetails).not.toHaveBeenCalled();
  });

  test('keeps the shipment list available when Velocity tracking fails', async () => {
    const shipment = {
      velocityBooked: true,
      carrierAWB: 'A1',
      status: ShipmentStatus.ORDER_CREATED,
    };
    velocityClient.getTrackingDetails.mockRejectedValue(new Error('Velocity unavailable'));

    await expect(syncListedShipmentsFromVelocity([shipment])).resolves.toEqual([shipment]);
    expect(shipment.status).toBe(ShipmentStatus.ORDER_CREATED);
  });
});
