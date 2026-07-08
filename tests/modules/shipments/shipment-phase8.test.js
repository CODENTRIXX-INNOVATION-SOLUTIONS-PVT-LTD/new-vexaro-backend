'use strict';

jest.mock('../../../src/utils/velocity', () => ({
  velocityClient: {
    getTrackingDetails: jest.fn(),
  },
}));

jest.mock('../../../src/modules/shipments/shipment.model', () => {
  const query = {
    populate: jest.fn(),
    then: jest.fn(),
  };
  query.populate.mockReturnValue(query);
  return {
    Shipment: {
      findOne: jest.fn().mockReturnValue(query),
    },
  };
});

jest.mock('../../../src/modules/users/user.repository');

const { velocityClient } = require('../../../src/utils/velocity');
const { Shipment } = require('../../../src/modules/shipments/shipment.model');
const { awbSearchService } = require('../../../src/modules/shipments/services/shipment-tracking.service');

describe('Phase 8: Tracking Integration Tests', () => {
  let mockShipment;
  const caller = { userId: 'merchant123', role: 'MERCHANT' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockShipment = {
      _id: 'ship123',
      awb: 'VX-123456-ABCDEF',
      carrierAWB: '9999999999',
      status: 'PICKED_UP',
      velocityBooked: true,
      statusHistory: [
        { status: 'ORDER_CREATED', timestamp: new Date('2026-07-08T10:00:00Z'), note: 'Created' },
      ],
      destination: { city: 'Mumbai', state: 'Maharashtra' },
      origin: { city: 'Delhi', state: 'Delhi' },
      toObject: jest.fn().mockImplementation(function () {
        const { toObject, ...rest } = this;
        return rest;
      }),
    };
    Shipment.findOne().then.mockImplementation((resolve) => resolve(mockShipment));
  });

  test('should successfully look up shipment by Vexaro AWB and pull live Velocity tracking details', async () => {
    velocityClient.getTrackingDetails.mockResolvedValue({
      '9999999999': {
        tracking_data: [
          { date: '2026-07-08T12:00:00Z', location: 'Delhi Hub', status: 'IN_TRANSIT', remark: 'Package moving' }
        ]
      }
    });

    const result = await awbSearchService('VX-123456-ABCDEF', caller);

    expect(Shipment.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [
          { awb: 'VX-123456-ABCDEF' },
          { carrierAWB: 'VX-123456-ABCDEF' },
          { carrierAWB: expect.any(Object) },
        ],
      })
    );

    expect(velocityClient.getTrackingDetails).toHaveBeenCalledWith(['9999999999']);
    expect(result.velocityTracking).toEqual(
      expect.objectContaining({
        tracking_data: expect.arrayContaining([
          expect.objectContaining({ location: 'Delhi Hub' })
        ])
      })
    );
  });

  test('should successfully look up shipment by carrier AWB and return local status details if Velocity tracking fails', async () => {
    velocityClient.getTrackingDetails.mockRejectedValue(new Error('Velocity tracking API unavailable'));

    const result = await awbSearchService('9999999999', caller);

    expect(velocityClient.getTrackingDetails).toHaveBeenCalledWith(['9999999999']);
    expect(result.velocityTracking).toBeNull();
    expect(result.awb).toBe('VX-123456-ABCDEF');
  });

  test('should query case-insensitively with regex when looking up carrier AWB', async () => {
    velocityClient.getTrackingDetails.mockResolvedValue({});

    await awbSearchService('9999999999', caller);

    expect(Shipment.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          expect.objectContaining({
            carrierAWB: expect.objectContaining({
              $regex: '^9999999999$',
              $options: 'i'
            })
          })
        ])
      })
    );
  });
});
