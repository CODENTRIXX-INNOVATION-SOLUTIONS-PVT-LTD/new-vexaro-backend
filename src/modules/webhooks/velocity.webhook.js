const crypto  = require('crypto');
const express = require('express');
const { env } = require('../../config/env');
const { updateShipmentStatusFromVelocityWebhook } = require('../shipments/shipment.service');
const logger  = require('../../utils/logger');

const webhookRouter = express.Router();

// Log a one-time warning at module load time if the secret is not configured.
if (!env.VELOCITY_WEBHOOK_SECRET) {
  logger.warn('velocity_webhook_secret_not_configured', {
    message: 'VELOCITY_WEBHOOK_SECRET is not set. Signature verification is DISABLED. Configure this in production.',
  });
}

/**
 * POST /api/webhooks/velocity
 *
 * Uses express.raw() to capture the unparsed request body so that the
 * HMAC-SHA256 signature can be verified over the raw bytes — same pattern
 * as the Razorpay webhook.
 *
 * Security:
 *   - If VELOCITY_WEBHOOK_SECRET is set, the X-Velocity-Signature header
 *     must be present and must match HMAC-SHA256(rawBody, secret).
 *   - If the secret is NOT configured, signature verification is skipped
 *     (development / initial integration mode).
 */
webhookRouter.post('/velocity', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody  = req.body; // Buffer — preserved by express.raw()
  const signature = req.headers['x-velocity-signature'];

  // ── 1. Mandatory Signature verification ──────────────────────────────────
  const secret = env.VELOCITY_WEBHOOK_SECRET || 'velocity_webhook_secret_development_mock_123';
  if (!signature) {
    logger.warn('velocity_webhook_invalid_signature', {
      reason: 'missing_header',
      ip: req.ip,
    });
    return res.status(401).json({ success: false, message: 'Missing X-Velocity-Signature header' });
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const isValid = (() => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(signature),
      );
    } catch {
      return false;
    }
  })();

  if (!isValid) {
    logger.warn('velocity_webhook_invalid_signature', {
      reason: 'signature_mismatch',
      ip: req.ip,
    });
    return res.status(401).json({ success: false, message: 'Invalid Velocity webhook signature' });
  }

  // ── 2. Parse payload ─────────────────────────────────────────────────────
  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ success: false, message: 'Malformed JSON payload' });
  }

  if (!payload || !payload.awb || !payload.event) {
    return res.status(400).json({ success: false, message: 'Missing required webhook fields: awb, event' });
  }

  logger.info('velocity_webhook_received', {
    awb:   payload.awb,
    event: payload.event,
    ip:    req.ip,
  });

  // ── 3. Replay attack check: assert event creation is within 5 minutes skew ────
  const headerTimestamp = req.headers['x-velocity-timestamp'] || req.headers['x-signature-timestamp'];
  const bodyTimestamp = payload.timestamp || payload.created_at || payload.createdAt;
  const rawTs = headerTimestamp || bodyTimestamp;
  if (rawTs) {
    const now = Math.floor(Date.now() / 1000);
    let ts = parseInt(rawTs, 10);
    if (isNaN(ts)) {
      ts = Math.floor(Date.parse(rawTs) / 1000);
    } else if (ts > 9999999999) {
      ts = Math.floor(ts / 1000);
    }

    if (!isNaN(ts)) {
      const skew = Math.abs(now - ts);
      if (skew > 300) {
        logger.warn('velocity_webhook_rejected', {
          reason: 'replay_skew_exceeded',
          skew,
          ip: req.ip,
        });
        return res.status(400).json({ success: false, message: 'Webhook event is older than skew limit (replay attack)' });
      }
    }
  }

  // ── 4. Process ──────────────────────────────────────────────────────────
  try {
    await updateShipmentStatusFromVelocityWebhook(payload);
    return res.status(200).json({ success: true, message: 'Velocity webhook processed' });
  } catch (err) {
    logger.error('velocity_webhook_processing_failed', {
      awb:   payload.awb,
      event: payload.event,
      error: err.message,
    });
    return res.status(500).json({ success: false, message: 'Failed to process Velocity webhook' });
  }
});

module.exports = { webhookRouter };
