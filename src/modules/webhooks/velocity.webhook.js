'use strict';

const express = require('express');
const { env } = require('../../config/env');
const logger = require('../../utils/logger');
const { updateShipmentStatusFromVelocityWebhook } = require('../shipments/shipment.service');

const webhookRouter = express.Router();

const getRawBody = (req) => {
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  return JSON.stringify(req.body || {});
};

const getAuthToken = (req) => {
  const auth = req.headers.authorization;
  if (Array.isArray(auth)) return auth[0];
  return auth || req.headers['x-webhook-token'];
};

const handleVelocityEvent = async (payload) => {
  const event = String(payload?.event || '').trim().toLowerCase();
  const data = payload?.data || {};

  if (event === 'status_change') {
    await updateShipmentStatusFromVelocityWebhook({
      awb: data.tracking_number,
      event: data.status,
      details: `Velocity status_change: ${data.status || 'unknown'}${data.carrier_name ? ` via ${data.carrier_name}` : ''}`,
    });
    return;
  }

  if (event === 'tracking_addition') {
    const tracking = data.new_tracking || {};
    await updateShipmentStatusFromVelocityWebhook({
      awb: data.tracking_number,
      event: data.status || tracking.status,
      details: tracking.remarks || 'Velocity tracking update',
    });
    return;
  }

  if (event === 'qc_update') {
    logger.info('velocity_webhook_qc_update_received', {
      awb: data.tracking_number,
      qcStatus: data.qc_status,
      qcFailureReason: data.qc_failure_reason || null,
    });
    return;
  }

  logger.info('velocity_webhook_unknown_event', { event: payload?.event || null });
};

webhookRouter.post('/velocity', express.raw({ type: '*/*' }), async (req, res) => {
  const receivedToken = getAuthToken(req);
  const expectedToken = env.VELOCITY_WEBHOOK_SECRET;

  if (!expectedToken) {
    logger.error('velocity_webhook_secret_missing');
    return res.status(500).json({ message: 'Velocity webhook secret is not configured' });
  }

  if (!receivedToken || receivedToken !== expectedToken) {
    logger.warn('velocity_webhook_unauthorized', { ip: req.ip });
    return res.status(401).json({ message: 'Unauthorized' });
  }

  let payload;
  try {
    payload = JSON.parse(getRawBody(req));
  } catch (err) {
    logger.warn('velocity_webhook_invalid_json', { error: err.message });
    return res.status(400).json({ message: 'Invalid JSON' });
  }

  res.status(200).json({ received: true });

  try {
    logger.info('velocity_webhook_received', {
      event: payload.event,
      eventId: payload.event_id || null,
      awb: payload.data?.tracking_number || null,
    });
    await handleVelocityEvent(payload);
  } catch (err) {
    logger.error('velocity_webhook_processing_failed', {
      event: payload.event,
      eventId: payload.event_id || null,
      error: err.message,
    });
  }
});

module.exports = { webhookRouter };
