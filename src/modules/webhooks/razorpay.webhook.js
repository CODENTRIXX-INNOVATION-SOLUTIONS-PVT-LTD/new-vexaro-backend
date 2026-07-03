// 'use strict';

// const crypto  = require('crypto');
// const express = require('express');
// const { env } = require('../../config/env');
// const { handleWebhookEvent } = require('../finance/razorpay.service');
// const { logAuditEvent } = require('../audit/audit.service');

// const webhookRouter = express.Router();
// console.log("✅ Razorpay webhook router loaded");

// /**
//  * POST /api/webhooks/razorpay
//  *
//  * Webhook signature verification and replay skew protection.
//  */
// webhookRouter.post(
//   '/razorpay',
//   express.raw({ type: 'application/json' }),
//   async (req, res) => {
//     const signature = req.headers['x-razorpay-signature'];
//     if (!signature) {
//       return res.status(400).json({ success: false, message: 'Missing X-Razorpay-Signature header' });
//     }

//     const secret = env.RAZORPAY_WEBHOOK_SECRET || 'razorpay_webhook_secret_development_mock_123';
//     const rawBody = req.body; // Buffer

//     const expectedSignature = crypto
//       .createHmac('sha256', secret)
//       .update(rawBody)
//       .digest('hex');

//     const isValid = (() => {
//       try {
//         return crypto.timingSafeEqual(
//           Buffer.from(expectedSignature),
//           Buffer.from(signature),
//         );
//       } catch {
//         return false;
//       }
//     })();

//     if (!isValid) {
//       logAuditEvent('SYSTEM', 'WEBHOOK_REJECTED', { type: 'razorpay', reason: 'signature_mismatch' });
//       return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
//     }

//     let parsed;
//     try {
//       parsed = JSON.parse(rawBody.toString('utf8'));
//     } catch {
//       return res.status(400).json({ success: false, message: 'Malformed JSON payload' });
//     }

//     // Replay attack check: assert event creation is within 5 minutes skew
//     const createdAt = parsed?.created_at;
//     if (createdAt) {
//       const now = Math.floor(Date.now() / 1000);
//       const skew = Math.abs(now - createdAt);
//       if (skew > 300) {
//         logAuditEvent('SYSTEM', 'WEBHOOK_REJECTED', { type: 'razorpay', reason: 'replay_skew_exceeded', skew });
//         return res.status(400).json({ success: false, message: 'Webhook event is older than skew limit (replay attack)' });
//       }
//     }

//     const event   = parsed?.event;
//     const payload = parsed?.payload;

//     if (!event) {
//       return res.status(400).json({ success: false, message: 'Missing event field in payload' });
//     }

//     logAuditEvent('SYSTEM', 'WEBHOOK_RECEIVED', { type: 'razorpay', event, id: parsed.id });

//     // Acknowledge immediately
//     res.status(200).json({ success: true, message: 'Webhook received' });

//     try {
//       await handleWebhookEvent(event, payload);
//     } catch (err) {
//       console.error(`[Razorpay Webhook] Error handling event "${event}":`, err.message);
//     }
//   },
// );

// module.exports = { webhookRouter };

"use strict";

const crypto = require("crypto");
const express = require("express");
const { env } = require("../../config/env");
const { handleWebhookEvent } = require("../finance/razorpay.service");
const { logAuditEvent } = require("../audit/audit.service");

const webhookRouter = express.Router();

console.log("✅ Razorpay webhook router loaded");

/**
 * POST /api/v1/webhook/razorpay
 */
webhookRouter.post(
  "/razorpay",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    console.log("🔥 Razorpay webhook request received");

    const signature = req.headers["x-razorpay-signature"];

    if (!signature) {
      console.log("❌ Missing X-Razorpay-Signature header");

      return res.status(400).json({
        success: false,
        message: "Missing X-Razorpay-Signature header",
      });
    }

    const secret =
      env.RAZORPAY_WEBHOOK_SECRET ||
      "razorpay_webhook_secret_development_mock_123";

    const rawBody = req.body;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    let isValid = false;

    try {
      isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature),
      );
    } catch (err) {
      console.error("❌ Signature comparison failed:", err.message);
    }

    if (!isValid) {
      console.log("❌ Invalid webhook signature");

      logAuditEvent("SYSTEM", "WEBHOOK_REJECTED", {
        type: "razorpay",
        reason: "signature_mismatch",
      });

      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(rawBody.toString("utf8"));
    } catch (err) {
      console.log("❌ Invalid JSON");

      return res.status(400).json({
        success: false,
        message: "Malformed JSON payload",
      });
    }

    const createdAt = parsed?.created_at;

    if (createdAt) {
      const now = Math.floor(Date.now() / 1000);
      const skew = Math.abs(now - createdAt);

      if (skew > 300) {
        logAuditEvent("SYSTEM", "WEBHOOK_REJECTED", {
          type: "razorpay",
          reason: "replay_skew_exceeded",
          skew,
        });

        return res.status(400).json({
          success: false,
          message: "Webhook event is older than skew limit",
        });
      }
    }

    const event = parsed?.event;
    const payload = parsed?.payload;

    if (!event) {
      return res.status(400).json({
        success: false,
        message: "Missing event field",
      });
    }

    console.log(`✅ Event Received: ${event}`);

    logAuditEvent("SYSTEM", "WEBHOOK_RECEIVED", {
      type: "razorpay",
      event,
      id: parsed.id,
    });

    res.status(200).json({
      success: true,
      message: "Webhook received",
    });

    try {
      await handleWebhookEvent(event, payload);
      console.log(`✅ Event Processed: ${event}`);
    } catch (err) {
      console.error(
        `[Razorpay Webhook] Error handling "${event}":`,
        err.message,
      );
    }
  },
);

module.exports = {
  webhookRouter,
};
