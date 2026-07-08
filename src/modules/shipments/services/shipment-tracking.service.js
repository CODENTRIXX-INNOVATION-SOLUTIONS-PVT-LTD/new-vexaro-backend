'use strict';

const { Shipment } = require('../shipment.model');
const { velocityClient } = require('../../../utils/velocity');

const awbSearchService = async (awb, caller) => {
  const rawAwb = String(awb || '').trim();
  const normalizedAwb = rawAwb.toUpperCase();
  const escapedAwb = rawAwb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const shipment = await Shipment.findOne({
    $or: [
      { awb: normalizedAwb },
      { carrierAWB: normalizedAwb },
      { carrierAWB: { $regex: `^${escapedAwb}$`, $options: 'i' } },
    ],
    deletedAt: null,
  })
    .populate('merchantId',    'firstName lastName email companyName')
    .populate('distributorId', 'firstName lastName email companyName')
    .populate('warehouseId',   'firstName lastName email companyName');

  if (!shipment) {
    const err = new Error(`No shipment found with AWB: ${awb}`);
    err.statusCode = 404;
    throw err;
  }

  let velocityTracking = null;
  if (shipment.velocityBooked && shipment.carrierAWB) {
    try {
      const carrierAwb = String(shipment.carrierAWB).trim();
      const trackingResult = await velocityClient.getTrackingDetails([carrierAwb]);
      velocityTracking = trackingResult[carrierAwb]
        || trackingResult[carrierAwb.toUpperCase()]
        || trackingResult[carrierAwb.toLowerCase()]
        || null;
    } catch (trackErr) {
      console.error(`[Velocity] Tracking fetch failed for AWB ${shipment.carrierAWB}:`, trackErr.message);
    }
  }

  return {
    ...shipment.toObject(),
    velocityTracking,
  };
};

module.exports = {
  awbSearchService,
};
