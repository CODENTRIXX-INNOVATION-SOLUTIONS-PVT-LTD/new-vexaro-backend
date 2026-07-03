'use strict';

const { Router } = require('express');
const { authMiddleware, requireRole } = require('../../middleware/auth.middleware');
const { validateRequest } = require('../../validation');
const { UserRole } = require('../../constants');
const schemas = require('../../validation/schemas/finance');
const rzp = require('./razorpay.controller');

const router = Router();

router.use(authMiddleware);

router.post(
  '/razorpay/create-order',
  requireRole(UserRole.MERCHANT, UserRole.DISTRIBUTOR),
  validateRequest({ body: schemas.createOrderSchema }),
  rzp.createOrder,
);

router.post(
  '/razorpay/verify',
  requireRole(UserRole.MERCHANT, UserRole.DISTRIBUTOR),
  validateRequest({ body: schemas.verifyPaymentSchema }),
  rzp.verifyPayment,
);

module.exports = router;
