'use strict';

const express = require('express');
const { handleWebhookEvent, verifyWebhookSignature } = require('../finance/razorpay.service');
const { logAuditEvent } = require('../audit/audit.service');
const logger = require('../../utils/logger');

const webhookRouter = express.Router();

webhookRouter.post(
  '/razorpay',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const eventId = req.headers['x-razorpay-event-id'] || null;

    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing X-Razorpay-Signature header' });
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    let isValid = false;
    try {
      isValid = verifyWebhookSignature(rawBody, signature);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }

    if (!isValid) {
      logAuditEvent('SYSTEM', 'WEBHOOK_REJECTED', {
        type: 'razorpay',
        reason: 'signature_mismatch',
        eventId,
      });
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ success: false, message: 'Malformed JSON payload' });
    }

    if (!parsed?.event) {
      return res.status(400).json({ success: false, message: 'Missing event field' });
    }

    try {
      await handleWebhookEvent(parsed.event, parsed.payload, eventId);
      logAuditEvent('SYSTEM', 'WEBHOOK_RECEIVED', {
        type: 'razorpay',
        event: parsed.event,
        id: parsed.id,
        eventId,
      });
      return res.status(200).json({ success: true, message: 'Webhook processed' });
    } catch (err) {
      logger.error('razorpay_webhook_processing_failed', {
        event: parsed.event,
        eventId,
        error: err.message,
      });
      return res.status(500).json({ success: false, message: 'Webhook processing failed' });
    }
  },
);

module.exports = {
  webhookRouter,
};
