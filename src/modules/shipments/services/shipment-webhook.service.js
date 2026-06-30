'use strict';

const { Shipment } = require('../shipment.model');
const { ShipmentStatus } = require('../../../constants');

const updateShipmentStatusFromVelocityWebhook = async (payload) => {
  const { awb, event, details } = payload;
  if (!awb || !event) {
    const err = new Error('Velocity webhook payload must include awb and event');
    err.statusCode = 400;
    throw err;
  }

  const shipment = await Shipment.findOne({
    $or: [
      { awb: awb.trim().toUpperCase() },
      { carrierAWB: awb.trim().toUpperCase() },
    ],
    deletedAt: null,
  });

  if (!shipment) {
    const err = new Error(`Shipment not found for AWB ${awb}`);
    err.statusCode = 404;
    throw err;
  }

  const normalizedEvent = String(event).trim().toLowerCase();
  const mapping = {
    order_created: ShipmentStatus.ORDER_CREATED,
    booked: ShipmentStatus.ORDER_CREATED,
    pickup: ShipmentStatus.PICKED_UP,
    picked_up: ShipmentStatus.PICKED_UP,
    pickedup: ShipmentStatus.PICKED_UP,
    'picked up': ShipmentStatus.PICKED_UP,
    arrived: ShipmentStatus.ARRIVED_AT_HUB,
    arrived_at_hub: ShipmentStatus.ARRIVED_AT_HUB,
    'arrived at hub': ShipmentStatus.ARRIVED_AT_HUB,
    out_for_delivery: ShipmentStatus.OUT_FOR_DELIVERY,
    'out for delivery': ShipmentStatus.OUT_FOR_DELIVERY,
    delivery_failed: ShipmentStatus.DELIVERY_FAILED,
    'delivery failed': ShipmentStatus.DELIVERY_FAILED,
    delivered: ShipmentStatus.DELIVERED,
    rto: ShipmentStatus.RTO,
    return_to_origin: ShipmentStatus.RTO,
    cancelled: ShipmentStatus.CANCELLED,
    cancel: ShipmentStatus.CANCELLED,
  };

  const nextStatus = mapping[normalizedEvent];
  if (!nextStatus) {
    const err = new Error(`Unsupported Velocity webhook event: ${event}`);
    err.statusCode = 400;
    throw err;
  }

  if (nextStatus === shipment.status) {
    return shipment;
  }

  if (!shipment.canTransitionTo(nextStatus) && nextStatus !== ShipmentStatus.ORDER_CREATED) {
    const err = new Error(`Cannot transition shipment ${shipment.awb} from ${shipment.status} to ${nextStatus}`);
    err.statusCode = 400;
    throw err;
  }

  shipment.statusHistory.push({
    status: nextStatus,
    updatedBy: null,
    note: details || `Velocity webhook event: ${event}`,
  });

  shipment.status = nextStatus;
  if (nextStatus === ShipmentStatus.DELIVERED) {
    shipment.deliveredAt = new Date();
  }
  if (nextStatus === ShipmentStatus.CANCELLED || nextStatus === ShipmentStatus.RTO) {
    shipment.deletedAt = nextStatus === ShipmentStatus.CANCELLED ? new Date() : shipment.deletedAt;
  }

  await shipment.save();
  return shipment;
};

module.exports = {
  updateShipmentStatusFromVelocityWebhook,
};
