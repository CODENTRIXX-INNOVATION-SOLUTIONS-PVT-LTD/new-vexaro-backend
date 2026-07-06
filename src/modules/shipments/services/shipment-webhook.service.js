'use strict';

const { Shipment } = require('../shipment.model');
const { ShipmentStatus, CODStatus } = require('../../../constants');
const { createNotification } = require('../../notifications/notification.service');
const logger = require('../../../utils/logger');

// ─── Velocity event string → internal ShipmentStatus ─────────────────────────
const VELOCITY_EVENT_MAP = {
  pending:             ShipmentStatus.ORDER_CREATED,
  ready_for_pickup:    ShipmentStatus.ORDER_CREATED,
  pickup_scheduled:    ShipmentStatus.ORDER_CREATED,
  not_picked:          ShipmentStatus.ORDER_CREATED,
  processing:          ShipmentStatus.ORDER_CREATED,
  order_created:       ShipmentStatus.ORDER_CREATED,
  booked:              ShipmentStatus.ORDER_CREATED,
  pickup:              ShipmentStatus.PICKED_UP,
  picked_up:           ShipmentStatus.PICKED_UP,
  pickedup:            ShipmentStatus.PICKED_UP,
  'picked up':         ShipmentStatus.PICKED_UP,
  in_transit:          ShipmentStatus.ARRIVED_AT_HUB,
  'in transit':        ShipmentStatus.ARRIVED_AT_HUB,
  arrived:             ShipmentStatus.ARRIVED_AT_HUB,
  arrived_at_hub:      ShipmentStatus.ARRIVED_AT_HUB,
  'arrived at hub':    ShipmentStatus.ARRIVED_AT_HUB,
  out_for_delivery:    ShipmentStatus.OUT_FOR_DELIVERY,
  'out for delivery':  ShipmentStatus.OUT_FOR_DELIVERY,
  ndr_raised:          ShipmentStatus.DELIVERY_FAILED,
  need_attention:      ShipmentStatus.DELIVERY_FAILED,
  reattempt_delivery:  ShipmentStatus.OUT_FOR_DELIVERY,
  lost:                ShipmentStatus.DELIVERY_FAILED,
  delivery_failed:     ShipmentStatus.DELIVERY_FAILED,
  'delivery failed':   ShipmentStatus.DELIVERY_FAILED,
  delivered:           ShipmentStatus.DELIVERED,
  rto:                 ShipmentStatus.RTO,
  rto_initiated:       ShipmentStatus.RTO,
  rto_in_transit:      ShipmentStatus.RTO,
  rto_need_attention:  ShipmentStatus.RTO,
  rto_delivered:       ShipmentStatus.RTO,
  return_to_origin:    ShipmentStatus.RTO,
  return_rejected:     ShipmentStatus.CANCELLED,
  return_pickup_scheduled: ShipmentStatus.ORDER_CREATED,
  return_not_picked:   ShipmentStatus.DELIVERY_FAILED,
  return_qc_failed:    ShipmentStatus.DELIVERY_FAILED,
  return_in_transit:   ShipmentStatus.ARRIVED_AT_HUB,
  return_delivered:    ShipmentStatus.DELIVERED,
  return_cancelled:    ShipmentStatus.CANCELLED,
  return_ndr_raised:   ShipmentStatus.DELIVERY_FAILED,
  return_need_attention: ShipmentStatus.DELIVERY_FAILED,
  rejected:            ShipmentStatus.CANCELLED,
  cancelled:           ShipmentStatus.CANCELLED,
  cancel:              ShipmentStatus.CANCELLED,
};

/**
 * Find a shipment by either our AWB or the carrier AWB Velocity sends back.
 * Velocity status_change / tracking_addition events contain the carrier AWB
 * in data.tracking_number, not our internal VX-* AWB.
 */
const findShipmentByAWB = (awb) => {
  const normalized = awb.trim().toUpperCase();
  return Shipment.findOne({
    $or: [
      { awb:        normalized },
      { carrierAWB: normalized },
    ],
    deletedAt: null,
  });
};

/**
 * Main entry point called by velocity.webhook.js for:
 *   - status_change events
 *   - tracking_addition events
 *
 * COD delivery flow:
 *   On DELIVERED + isCOD → create/update COD escrow record.
 *   Remittance to merchant wallet is triggered separately by the distributor
 *   via POST /api/v1/finance/cod/:id/remit.
 */
const updateShipmentStatusFromVelocityWebhook = async (payload) => {
  const { awb, event, details } = payload;

  if (!awb || !event) {
    throw Object.assign(
      new Error('Velocity webhook payload must include awb and event'),
      { statusCode: 400 },
    );
  }

  const shipment = await findShipmentByAWB(awb);

  if (!shipment) {
    // Not an error — Velocity may send events for orders placed outside Vexaro.
    // Log as warning and throw 404 so the webhook handler can log it without
    // treating it as a processing failure.
    logger.warn('velocity_webhook_shipment_not_found', { awb });
    throw Object.assign(
      new Error(`Shipment not found for AWB ${awb}`),
      { statusCode: 404 },
    );
  }

  const normalizedEvent = String(event).trim().toLowerCase();
  const nextStatus = VELOCITY_EVENT_MAP[normalizedEvent];

  if (!nextStatus) {
    logger.warn('velocity_webhook_unknown_status_event', { awb, event });
    throw Object.assign(
      new Error(`Unsupported Velocity webhook event: "${event}"`),
      { statusCode: 400 },
    );
  }

  // ── Idempotent: already at target status ─────────────────────────────────
  if (nextStatus === shipment.status) {
    logger.info('velocity_webhook_status_already_current', { awb: shipment.awb, status: nextStatus });
    return shipment;
  }

  // ── Guard invalid state-machine transitions ───────────────────────────────
  // ORDER_CREATED is allowed from any state (Velocity sometimes re-sends booked events).
  if (!shipment.canTransitionTo(nextStatus) && nextStatus !== ShipmentStatus.ORDER_CREATED) {
    logger.warn('velocity_webhook_invalid_transition', {
      awb:    shipment.awb,
      from:   shipment.status,
      to:     nextStatus,
      event,
    });
    throw Object.assign(
      new Error(`Cannot transition shipment ${shipment.awb} from ${shipment.status} → ${nextStatus}`),
      { statusCode: 400 },
    );
  }

  // ── Apply the status ──────────────────────────────────────────────────────
  shipment.statusHistory.push({
    status:    nextStatus,
    updatedBy: null,
    note:      details || `Velocity webhook: ${event}`,
  });
  shipment.status = nextStatus;

  if (nextStatus === ShipmentStatus.DELIVERED) {
    shipment.deliveredAt = new Date();
  }
  // Soft-delete only for CANCELLED coming from a webhook — not for RTO
  // (RTO shipments still need to be visible in the dashboard)

  await shipment.save();

  logger.info('velocity_webhook_status_updated', {
    awb:    shipment.awb,
    status: nextStatus,
    event,
  });

  // ── COD: create escrow record on delivery ─────────────────────────────────
  if (nextStatus === ShipmentStatus.DELIVERED && shipment.isCOD && shipment.codAmount > 0) {
    try {
      await _handleCodOnDelivery(shipment);
    } catch (codErr) {
      // Log but never fail the webhook — status is already saved
      logger.error('webhook_cod_record_failed', {
        awb:   shipment.awb,
        error: codErr.message,
      });
    }
  }

  return shipment;
};

/**
 * Creates or idempotently updates the COD escrow record when a COD shipment
 * is delivered. Safe to call multiple times for the same shipment (Velocity
 * may retry webhook delivery).
 */
const _handleCodOnDelivery = async (shipment) => {
  const { COD } = require('../../finance/finance.model');

  const existing = await COD.findOne({ shipmentId: shipment._id });

  if (existing) {
    if (existing.status === CODStatus.PENDING && !existing.collectedAt) {
      existing.collectedAt = new Date();
      await existing.save();
      logger.info('webhook_cod_collected_updated', {
        awb:       shipment.awb,
        codAmount: shipment.codAmount,
      });
    }
    return existing;
  }

  const codRecord = await COD.create({
    shipmentId:    shipment._id,
    merchantId:    shipment.merchantId,
    distributorId: shipment.distributorId || null,
    codAmount:     shipment.codAmount,
    status:        CODStatus.PENDING,
    collectedAt:   new Date(),
  });

  logger.info('webhook_cod_record_created', {
    awb:        shipment.awb,
    codAmount:  shipment.codAmount,
    merchantId: shipment.merchantId,
  });

  try {
    await createNotification(shipment.merchantId.toString(), {
      title:   'COD Collected',
      message: `COD of ₹${shipment.codAmount.toFixed(2)} for ${shipment.awb} has been collected and is pending remittance to your wallet.`,
      type:    'PAYMENT',
    });
  } catch (notifErr) {
    logger.warn('webhook_cod_notification_failed', {
      awb:   shipment.awb,
      error: notifErr.message,
    });
  }

  return codRecord;
};

module.exports = { updateShipmentStatusFromVelocityWebhook };
