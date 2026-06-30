const { Router } = require('express');
const {
  login,
  verifyInvite,
  setPassword,
  forgotPassword,
  resetPassword,
  getMe,
  changeInitialCredentials,
  refreshToken,
  logout,
} = require('./auth.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { validateRequest } = require('../../validation');
const authSchemas = require('../../validation/schemas/auth');
const { emptyObjectSchema } = require('../../validation/schemas/common/base.schemas');

const router = Router();

router.post('/login', validateRequest({ body: authSchemas.loginSchema }), login);
router.get('/verify-invite', validateRequest({ query: authSchemas.verifyInviteQuerySchema }), verifyInvite);
router.post('/set-password', validateRequest({ body: authSchemas.setPasswordSchema }), setPassword);
router.post('/forgot-password', validateRequest({ body: authSchemas.forgotPasswordSchema }), forgotPassword);
router.post('/reset-password', validateRequest({ body: authSchemas.resetPasswordSchema }), resetPassword);
router.get('/me', authMiddleware, validateRequest({ query: emptyObjectSchema }), getMe);
router.post(
  '/change-initial-credentials',
  authMiddleware,
  validateRequest({ body: authSchemas.changeInitialCredentialsSchema }),
  changeInitialCredentials
);

// ─── Refresh & Logout (no auth required — token in body) ─────────────────────
router.post('/refresh', validateRequest({ body: authSchemas.refreshTokenSchema }), refreshToken);
router.post('/logout', validateRequest({ body: authSchemas.refreshTokenSchema }), logout);

module.exports = router;
