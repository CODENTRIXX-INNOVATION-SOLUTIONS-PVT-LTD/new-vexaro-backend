'use strict';

const { Router } = require('express');
const { authMiddleware, requireRole } = require('../../middleware/auth.middleware');
const { validateRequest } = require('../../validation');
const { UserRole } = require('../../constants');
const schemas = require('../../validation/schemas/finance');
const rzp = require('./razorpay.controller');

const router = Router();

router.use(authMiddleware);

// All roles that can top up their own wallet via Razorpay
const TOPUP_ROLES = [UserRole.MERCHANT, UserRole.DISTRIBUTOR, UserRole.SUPER_ADMIN];

router.post(
  '/razorpay/create-order',
  requireRole(...TOPUP_ROLES),
  validateRequest({ body: schemas.createOrderSchema }),
  rzp.createOrder,
);

router.post(
  '/razorpay/verify',
  requireRole(...TOPUP_ROLES),
  validateRequest({ body: schemas.verifyPaymentSchema }),
  rzp.verifyPayment,
);

module.exports = router;
