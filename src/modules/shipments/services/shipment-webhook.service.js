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
  externally_fulfilled: ShipmentStatus.DELIVERED,
  rto:                 ShipmentStatus.RTO,
  rto_initiated:       ShipmentStatus.RTO,
  rto_cancelled:       ShipmentStatus.DELIVERY_FAILED,
  rto_in_transit:      ShipmentStatus.RTO,
  rto_need_attention:  ShipmentStatus.RTO,
  rto_delivered:       ShipmentStatus.RTO,
  rto_lost:            ShipmentStatus.DELIVERY_FAILED,
  return_to_origin:    ShipmentStatus.RTO,
  return_rejected:     ShipmentStatus.CANCELLED,
  return_pickup_scheduled: ShipmentStatus.ORDER_CREATED,
  return_picked_up:    ShipmentStatus.PICKED_UP,
  return_not_picked:   ShipmentStatus.DELIVERY_FAILED,
  return_qc_failed:    ShipmentStatus.DELIVERY_FAILED,
  return_in_transit:   ShipmentStatus.ARRIVED_AT_HUB,
  return_delivered:    ShipmentStatus.DELIVERED,
  return_lost:         ShipmentStatus.DELIVERY_FAILED,
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

const normalizeVelocityStatus = (value) => {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeShipmentType = (value) => {
  const shipmentType = String(value || '').trim().toLowerCase();
  return ['forward', 'return', 'rto'].includes(shipmentType) ? shipmentType : null;
};

const applyVelocityWebhookFields = (shipment, payload) => {
  const carrierAWB = payload.carrierAWB || payload.awb;
  const estimatedDelivery = toDateOrNull(payload.estimatedDelivery);
  const originalEstimatedDelivery = toDateOrNull(payload.originalEstimatedDelivery);
  const deliveredAt = toDateOrNull(payload.deliveredAt);
  const shipmentType = normalizeShipmentType(payload.shipmentType);

  if (payload.velocityShipmentId) shipment.velocityShipmentId = String(payload.velocityShipmentId).trim();
  if (payload.velocityOrderId) shipment.velocityOrderId = String(payload.velocityOrderId).trim();
  if (payload.merchantOrderRef) shipment.merchantOrderRef = String(payload.merchantOrderRef).trim();
  if (payload.carrierName) shipment.carrier = String(payload.carrierName).trim();
  if (carrierAWB) shipment.carrierAWB = String(carrierAWB).trim().toUpperCase();
  if (estimatedDelivery) shipment.estimatedDelivery = estimatedDelivery;
  if (originalEstimatedDelivery) shipment.originalEstimatedDelivery = originalEstimatedDelivery;
  if (deliveredAt) shipment.deliveredAt = deliveredAt;
  if (payload.trackingUrl) shipment.trackingUrl = String(payload.trackingUrl).trim();
  if (payload.subStatus) shipment.subStatus = String(payload.subStatus).trim();
  if (shipmentType) shipment.shipmentType = shipmentType;
};

const canApplyWebhookStatus = (shipment, nextStatus) => {
  if (nextStatus === shipment.status) return true;
  if (shipment.status === ShipmentStatus.DELIVERED && nextStatus !== ShipmentStatus.DELIVERED) return false;
  if (shipment.status === ShipmentStatus.CANCELLED && nextStatus !== ShipmentStatus.CANCELLED) return false;
  return true;
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
  const eventId = payload.eventId ? String(payload.eventId).trim() : null;

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

  shipment.velocityWebhookEventIds = shipment.velocityWebhookEventIds || [];

  if (eventId && shipment.velocityWebhookEventIds.includes(eventId)) {
    logger.info('velocity_webhook_duplicate_ignored', {
      awb: shipment.awb,
      eventId,
    });
    return shipment;
  }

  applyVelocityWebhookFields(shipment, payload);

  const normalizedEvent = normalizeVelocityStatus(event);
  const nextStatus = VELOCITY_EVENT_MAP[normalizedEvent];

  if (!nextStatus) {
    logger.warn('velocity_webhook_unknown_status_event', { awb, event });
    if (eventId) shipment.velocityWebhookEventIds.push(eventId);
    await shipment.save();
    return shipment;
  }

  // ── Idempotent: already at target status ─────────────────────────────────
  if (nextStatus === shipment.status) {
    if (eventId) shipment.velocityWebhookEventIds.push(eventId);
    await shipment.save();
    logger.info('velocity_webhook_status_already_current', {
      awb: shipment.awb,
      status: nextStatus,
      eventId,
    });
    return shipment;
  }

  // ── Guard invalid state-machine transitions ───────────────────────────────
  // ORDER_CREATED is allowed from any state (Velocity sometimes re-sends booked events).
  if (!canApplyWebhookStatus(shipment, nextStatus)) {
    logger.warn('velocity_webhook_invalid_transition', {
      awb:    shipment.awb,
      from:   shipment.status,
      to:     nextStatus,
      event,
      eventId,
    });
    if (eventId) shipment.velocityWebhookEventIds.push(eventId);
    await shipment.save();
    return shipment;
  }

  // ── Apply the status ──────────────────────────────────────────────────────
  shipment.statusHistory.push({
    status:    nextStatus,
    updatedBy: null,
    note:      details || `Velocity webhook: ${event}${eventId ? ` (${eventId})` : ''}`,
  });
  shipment.status = nextStatus;
  if (eventId) shipment.velocityWebhookEventIds.push(eventId);

  if (nextStatus === ShipmentStatus.DELIVERED) {
    shipment.deliveredAt = toDateOrNull(payload.deliveredAt) || new Date();
  }
  await shipment.save();

  logger.info('velocity_webhook_status_updated', {
    awb:    shipment.awb,
    status: nextStatus,
    event,
    eventId,
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
