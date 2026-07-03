'use strict';

const express = require('express');
const { env } = require('../../config/env');
const logger = require('../../utils/logger');
const { updateShipmentStatusFromVelocityWebhook } = require('../shipments/shipment.service');
const { Shipment } = require('../shipments/shipment.model');

const webhookRouter = express.Router();

// Velocity IP whitelist as per official documentation
const VELOCITY_IP_WHITELIST = [
  '15.207.255.190/32',
  '13.202.145.74/32',
];

const isIpWhitelisted = (req) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!ip) return false;
  
  // Handle X-Forwarded-For header (may contain multiple IPs)
  const forwardedFor = req.headers['x-forwarded-for'];
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : ip;
  
  // Simple CIDR check for /32 (single IP)
  for (const cidr of VELOCITY_IP_WHITELIST) {
    if (cidr.endsWith('/32')) {
      const whitelistedIp = cidr.slice(0, -3);
      if (clientIp === whitelistedIp) return true;
    }
  }
  
  return false;
};

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

    // Update shipment QC status
    try {
      const shipment = await Shipment.findOne({ awb: data.tracking_number });
      if (shipment) {
        shipment.qcStatus = data.qc_status || null;
        shipment.qcFailureReason = data.qc_failure_reason || null;
        shipment.qcImages = data.qc_images || [];
        shipment.qcCheckedAt = new Date();
        await shipment.save();
        logger.info('velocity_webhook_qc_status_updated', {
          awb: data.tracking_number,
          qcStatus: data.qc_status,
        });
      }
    } catch (err) {
      logger.error('velocity_webhook_qc_update_failed', {
        awb: data.tracking_number,
        error: err.message,
      });
    }
    return;
  }

  logger.info('velocity_webhook_unknown_event', { event: payload?.event || null });
};

webhookRouter.post('/velocity', express.raw({ type: '*/*' }), async (req, res) => {
  // IP whitelisting check
  if (!isIpWhitelisted(req)) {
    logger.warn('velocity_webhook_ip_not_whitelisted', { ip: req.ip, forwardedFor: req.headers['x-forwarded-for'] });
    return res.status(403).json({ message: 'IP not whitelisted' });
  }

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
    
    // Timeout enforcement - 10 seconds per Velocity spec
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Webhook processing timeout')), 10000)
    );
    
    await Promise.race([
      handleVelocityEvent(payload),
      timeoutPromise
    ]);
  } catch (err) {
    logger.error('velocity_webhook_processing_failed', {
      event: payload.event,
      eventId: payload.event_id || null,
      error: err.message,
    });
  }
});

module.exports = { webhookRouter };
