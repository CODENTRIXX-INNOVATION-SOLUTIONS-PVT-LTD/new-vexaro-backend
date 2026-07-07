'use strict';

const express = require('express');
const { env }  = require('../../config/env');
const logger   = require('../../utils/logger');
const { updateShipmentStatusFromVelocityWebhook } = require('../shipments/shipment.service');
const { Shipment } = require('../shipments/shipment.model');

const webhookRouter = express.Router();

// ── Velocity IP whitelist (production only) ───────────────────────────────────
const VELOCITY_IP_WHITELIST = ['15.207.255.190', '13.202.145.74'];

const isIpWhitelisted = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp  = forwarded ? forwarded.split(',')[0].trim() : (req.ip || '');
  const normalized = clientIp.replace(/^::ffff:/, '');
  return VELOCITY_IP_WHITELIST.includes(normalized);
};

const getRawBody = (req) => {
  if (Buffer.isBuffer(req.body))    return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  return JSON.stringify(req.body || {});
};

const getAuthToken = (req) => {
  const raw = req.headers['x-api-key'] || req.headers['x-webhook-token'] || req.headers.authorization || '';
  const token = Array.isArray(raw) ? raw[0] : raw;
  return String(token)
    .replace(/^(bearer|token|apikey|api-key)\s+/i, '')
    .trim();
};

const normalizeQcStatus = (value) => {
  if (!value) return null;
  return String(value).trim().toUpperCase().replace(/[\s-]+/g, '_');
};

const buildShipmentPayload = (payload, data, event, details) => ({
  awb:                       data.tracking_number,
  carrierAWB:                data.tracking_number,
  event,
  eventId:                   payload.event_id,
  eventTimestamp:            payload.event_timestamp,
  details,
  velocityShipmentId:        data.shipment_id,
  velocityOrderId:           data.order_id,
  merchantOrderRef:          data.order_external_id,
  orderDisplayId:            data.order_display_id,
  carrierName:               data.carrier_name,
  estimatedDelivery:         data.estimated_delivery_date,
  originalEstimatedDelivery: data.original_edd,
  deliveredAt:               data.delivered_at,
  trackingUrl:               data.tracking_url,
  subStatus:                 data.sub_status,
  shipmentType:              data.shipment_type,
});

// ── Event dispatcher ──────────────────────────────────────────────────────────
const handleVelocityEvent = async (payload) => {
  const event = String(payload?.event || '').trim().toLowerCase();
  const data  = payload?.data || {};

  // ── status_change ──────────────────────────────────────────────────────────
  if (event === 'status_change') {
    await updateShipmentStatusFromVelocityWebhook(buildShipmentPayload(
      payload,
      data,
      data.status,
      `Velocity status_change: ${data.status || 'unknown'}${data.sub_status ? ` (${data.sub_status})` : ''}${data.carrier_name ? ` via ${data.carrier_name}` : ''}`,
    ));
    return;
  }

  // ── tracking_addition ──────────────────────────────────────────────────────
  if (event === 'tracking_addition') {
    const tracking = data.new_tracking || {};
    const details = [
      tracking.remarks || 'Velocity tracking update',
      tracking.location ? `Location: ${tracking.location}` : null,
      tracking.event_date_time ? `Event time: ${tracking.event_date_time}` : null,
    ].filter(Boolean).join(' | ');

    await updateShipmentStatusFromVelocityWebhook(buildShipmentPayload(
      payload,
      data,
      data.status || tracking.status,
      details,
    ));
    return;
  }

  // ── qc_update ─────────────────────────────────────────────────────────────
  if (event === 'qc_update') {
    logger.info('velocity_webhook_qc_update_received', {
      awb:             data.tracking_number,
      qcStatus:        data.qc_status,
      qcFailureReason: data.qc_failure_reason || null,
    });

    try {
      // Match by our AWB OR the carrier AWB — Velocity sends the carrier AWB
      const awbNorm = (data.tracking_number || '').trim().toUpperCase();
      const shipment = await Shipment.findOne({
        $or: [
          { awb:        awbNorm },
          { carrierAWB: awbNorm },
        ],
        deletedAt: null,
      });

      if (!shipment) {
        logger.warn('velocity_webhook_qc_shipment_not_found', { awb: data.tracking_number });
        return;
      }

      shipment.velocityWebhookEventIds = shipment.velocityWebhookEventIds || [];

      if (payload.event_id && shipment.velocityWebhookEventIds.includes(payload.event_id)) {
        logger.info('velocity_webhook_qc_duplicate_ignored', {
          awb: shipment.awb,
          eventId: payload.event_id,
        });
        return;
      }

      if (data.shipment_id) shipment.velocityShipmentId = String(data.shipment_id).trim();
      if (data.order_id) shipment.velocityOrderId = String(data.order_id).trim();
      if (data.order_external_id) shipment.merchantOrderRef = String(data.order_external_id).trim();
      if (data.carrier_name) shipment.carrier = String(data.carrier_name).trim();
      if (data.tracking_number) shipment.carrierAWB = String(data.tracking_number).trim().toUpperCase();
      if (data.tracking_url) shipment.trackingUrl = String(data.tracking_url).trim();
      if (data.sub_status) shipment.subStatus = String(data.sub_status).trim();
      if (data.shipment_type && ['forward', 'return', 'rto'].includes(String(data.shipment_type).trim().toLowerCase())) {
        shipment.shipmentType = String(data.shipment_type).trim().toLowerCase();
      }
      shipment.qcStatus        = normalizeQcStatus(data.qc_status);
      shipment.qcFailureReason = data.qc_failure_reason || null;
      shipment.qcImages        = Array.isArray(data.qc_images) ? data.qc_images : [];
      shipment.qcCheckedAt     = new Date();
      if (payload.event_id) shipment.velocityWebhookEventIds.push(payload.event_id);
      await shipment.save();

      logger.info('velocity_webhook_qc_status_updated', {
        awb:      shipment.awb,
        qcStatus: data.qc_status,
      });
    } catch (err) {
      logger.error('velocity_webhook_qc_update_failed', {
        awb:   data.tracking_number,
        error: err.message,
      });
    }
    return;
  }

  logger.info('velocity_webhook_unknown_event', { event: payload?.event || null });
};

// ── POST /velocity ─────────────────────────────────────────────────────────────
webhookRouter.post('/velocity', express.raw({ type: '*/*' }), async (req, res) => {

  // 1. IP whitelist — production only
  if (env.NODE_ENV === 'production' && !isIpWhitelisted(req)) {
    logger.warn('velocity_webhook_ip_not_whitelisted', {
      ip:          req.ip,
      forwardedFor: req.headers['x-forwarded-for'],
    });
    return res.status(403).json({ message: 'IP not whitelisted' });
  }

  // 2. Token auth
  const receivedToken = getAuthToken(req);
  const expectedToken = String(env.VELOCITY_WEBHOOK_SECRET || '').trim();

  if (!expectedToken) {
    logger.error('velocity_webhook_secret_missing');
    return res.status(500).json({ message: 'Velocity webhook secret is not configured' });
  }

  if (!receivedToken || receivedToken !== expectedToken) {
    logger.warn('velocity_webhook_unauthorized', { ip: req.ip });
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // 3. Parse body
  let payload;
  try {
    payload = JSON.parse(getRawBody(req));
  } catch (err) {
    logger.warn('velocity_webhook_invalid_json', { error: err.message });
    return res.status(400).json({ message: 'Invalid JSON' });
  }

  // 4. Respond immediately — Velocity requires 200 within 10 s
  res.status(200).json({ received: true });

  // 5. Process asynchronously with timeout guard
  setImmediate(async () => {
    try {
      logger.info('velocity_webhook_received', {
        event:   payload.event,
        eventId: payload.event_id || null,
        awb:     payload.data?.tracking_number || null,
      });

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Webhook processing timeout (10 s)')), 10_000),
      );

      await Promise.race([handleVelocityEvent(payload), timeout]);
    } catch (err) {
      // 404 = shipment not in our system; log as warning, not processing failure.
      const level = err.statusCode === 404 ? 'warn' : 'error';
      logger[level]('velocity_webhook_processing_failed', {
        event:   payload.event,
        eventId: payload.event_id || null,
        awb:     payload.data?.tracking_number || null,
        error:   err.message,
      });
    }
  });
});

module.exports = { webhookRouter };
