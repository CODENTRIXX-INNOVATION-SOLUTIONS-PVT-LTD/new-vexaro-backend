const express = require('express');
const { webhookRouter: razorpayWebhookRouter } = require('./razorpay.webhook');
const { webhookRouter: velocityWebhookRouter } = require('./velocity.webhook');

const webhookRouter = express.Router();
webhookRouter.use(razorpayWebhookRouter);
webhookRouter.use(velocityWebhookRouter);

module.exports = webhookRouter;
