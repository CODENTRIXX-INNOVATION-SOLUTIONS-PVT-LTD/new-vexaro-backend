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
    const eventId   = req.headers['x-razorpay-event-id'] || null;
    const startedAt = Date.now();

    // ── 1. Signature header present? ──────────────────────────────────────────
    if (!signature) {
      logger.warn('razorpay_webhook_missing_signature', {
        ip: req.ip,
        userAgent: req.headers['user-agent'] || '—',
        eventId,
      });
      return res.status(400).json({ success: false, message: 'Missing X-Razorpay-Signature header' });
    }

    // ── 2. Verify HMAC signature ───────────────────────────────────────────────
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    let isValid = false;
    try {
      isValid = verifyWebhookSignature(rawBody, signature);
    } catch (err) {
      logger.error('razorpay_webhook_signature_check_error', {
        error: err.message,
        eventId,
      });
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }

    if (!isValid) {
      logger.warn('razorpay_webhook_invalid_signature', {
        eventId,
        ip: req.ip,
      });
      logAuditEvent(null, 'WEBHOOK_REJECTED', {
        type: 'razorpay',
        reason: 'signature_mismatch',
        eventId,
      });
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    // ── 3. Parse payload ───────────────────────────────────────────────────────
    let parsed;
    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch {
      logger.error('razorpay_webhook_malformed_json', { eventId });
      return res.status(400).json({ success: false, message: 'Malformed JSON payload' });
    }

    if (!parsed?.event) {
      logger.warn('razorpay_webhook_missing_event_field', { eventId, keys: Object.keys(parsed || {}) });
      return res.status(400).json({ success: false, message: 'Missing event field' });
    }

    const event = parsed.event;

    // Extract key identifiers for logging
    const paymentId = parsed.payload?.payment?.entity?.id   || null;
    const orderId   = parsed.payload?.payment?.entity?.order_id
                   || parsed.payload?.order?.entity?.id     || null;
    const refundId  = parsed.payload?.refund?.entity?.id    || null;
    const amount    = parsed.payload?.payment?.entity?.amount || null;

    logger.info('razorpay_webhook_received', {
      event,
      eventId,
      paymentId,
      orderId,
      refundId,
      amountPaise: amount,
      amountRupees: amount ? (amount / 100).toFixed(2) : null,
    });

    // ── 4. Dispatch to handler ─────────────────────────────────────────────────
    try {
      const result = await handleWebhookEvent(parsed.event, parsed.payload, eventId);
      const durationMs = Date.now() - startedAt;

      if (result?.ignored) {
        // Event type not handled — not an error, just not relevant
        logger.info('razorpay_webhook_ignored', {
          event,
          eventId,
          durationMs,
        });
      } else if (result?.alreadyProcessed) {
        // Idempotency guard fired — payment was already credited, no double-credit
        logger.info('razorpay_webhook_already_processed', {
          event,
          eventId,
          paymentId,
          orderId,
          durationMs,
          message: 'Duplicate webhook — skipped safely (idempotent)',
        });
      } else {
        // Successfully processed
        logger.info('razorpay_webhook_processed', {
          event,
          eventId,
          paymentId,
          orderId,
          refundId,
          durationMs,
          result: JSON.stringify(result)?.slice(0, 200),
        });

        logAuditEvent(null, 'WEBHOOK_RECEIVED', {
          type: 'razorpay',
          event: parsed.event,
          id: parsed.id,
          eventId,
          paymentId,
          orderId,
        });
      }

      return res.status(200).json({ success: true, message: 'Webhook processed' });

    } catch (err) {
      const durationMs = Date.now() - startedAt;
      logger.error('razorpay_webhook_processing_failed', {
        event,
        eventId,
        paymentId,
        orderId,
        durationMs,
        error: err.message,
        statusCode: err.statusCode || 500,
        stack: err.stack?.split('\n').slice(0, 5).join(' | '),
      });
      return res.status(500).json({ success: false, message: 'Webhook processing failed' });
    }
  },
);

module.exports = { webhookRouter };
