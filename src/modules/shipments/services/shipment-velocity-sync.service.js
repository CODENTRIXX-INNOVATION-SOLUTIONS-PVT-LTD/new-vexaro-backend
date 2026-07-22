'use strict';

const { ShipmentStatus } = require('../../../constants');
const { velocityClient } = require('../../../utils/velocity');
const logger = require('../../../utils/logger');
const { updateShipmentStatusFromVelocityWebhook } = require('./shipment-webhook.service');

const TERMINAL_STATUSES = new Set([
  ShipmentStatus.DELIVERED,
  ShipmentStatus.CANCELLED,
  ShipmentStatus.RTO,
]);

const firstNonEmpty = (...values) => values.find((value) => (
  typeof value === 'string' && value.trim()
));

const getTrackingStatus = (tracking) => {
  if (!tracking || typeof tracking !== 'object') return null;

  const events = Array.isArray(tracking.tracking_data)
    ? tracking.tracking_data
    : Array.isArray(tracking.trackings)
      ? tracking.trackings
      : [];
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;

  return firstNonEmpty(
    tracking.status,
    tracking.shipment_status,
    tracking.current_status,
    tracking.latest_status,
    tracking.sub_status,
    latestEvent?.status,
    latestEvent?.shipment_status,
  ) || null;
};

const findTrackingByAwb = (trackingByAwb, awb) => {
  if (!trackingByAwb || !awb) return null;
  return trackingByAwb[awb]
    || trackingByAwb[awb.toUpperCase()]
    || trackingByAwb[awb.toLowerCase()]
    || Object.values(trackingByAwb).find((entry) => {
      const entryAwb = entry?.awb || entry?.awb_code || entry?.tracking_number;
      return String(entryAwb || '').trim().toUpperCase() === awb.toUpperCase();
    })
    || null;
};

/**
 * Best-effort reconciliation for shipments already displayed on a list page.
 * Webhooks remain the primary update path; this closes gaps when a Velocity
 * dashboard action occurs while webhook delivery is delayed or unavailable.
 */
const syncListedShipmentsFromVelocity = async (shipments) => {
  const candidates = shipments.filter((shipment) => (
    shipment.velocityBooked
    && shipment.carrierAWB
    && !TERMINAL_STATUSES.has(shipment.status)
  ));

  if (candidates.length === 0) return shipments;

  const awbs = [...new Set(candidates.map((shipment) => String(shipment.carrierAWB).trim()))];

  try {
    const trackingByAwb = await velocityClient.getTrackingDetails(awbs);

    await Promise.all(candidates.map(async (shipment) => {
      const carrierAWB = String(shipment.carrierAWB).trim();
      const tracking = findTrackingByAwb(trackingByAwb, carrierAWB);
      const velocityStatus = getTrackingStatus(tracking);
      if (!velocityStatus) return;

      const updated = await updateShipmentStatusFromVelocityWebhook({
        awb: carrierAWB,
        event: velocityStatus,
        subStatus: tracking?.sub_status,
        details: `Velocity live reconciliation: ${velocityStatus}`,
      });

      shipment.status = updated.status;
      shipment.subStatus = updated.subStatus || shipment.subStatus;
      shipment.statusHistory = updated.statusHistory;
    }));
  } catch (error) {
    logger.warn('velocity_list_reconciliation_failed', {
      awbs,
      error: error.message,
    });
  }

  return shipments;
};

module.exports = {
  getTrackingStatus,
  syncListedShipmentsFromVelocity,
};
