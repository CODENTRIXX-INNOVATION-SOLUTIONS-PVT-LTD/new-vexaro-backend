const {
  loginService,
  refreshTokenService,
  logoutService,
  verifyInviteService,
  setPasswordService,
  forgotPasswordService,
  resetPasswordService,
  getMeService,
  changeInitialCredentialsService
} = require('./auth.service');
const { success, created } = require('../../utils');
const { wrapController } = require('../../utils/errors');

const withErrorHandling = wrapController;

const login = withErrorHandling(async (req, res) => {
  const result = await loginService(req.validated.body);
  success(res, 'Login successful', result);
});

const verifyInvite = withErrorHandling(async (req, res) => {
  const { token } = req.validated.query;
  const result = await verifyInviteService(token);
  success(res, 'Invite token is valid', result);
});

const setPassword = withErrorHandling(async (req, res) => {
  const result = await setPasswordService(req.validated.body);
  created(res, 'Account activated successfully', result);
});

const forgotPassword = withErrorHandling(async (req, res) => {
  const dto = req.validated.body;
  try {
    await forgotPasswordService(dto);
  } catch (error) {
    // Suppress non-validation errors to prevent email enumeration
  }
  success(res, 'If that email exists, a reset link has been sent.');
});

const resetPassword = withErrorHandling(async (req, res) => {
  const result = await resetPasswordService(req.validated.body);
  success(res, result.message);
});

const getMe = withErrorHandling(async (req, res) => {
  if (!req.user) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }
  const user = await getMeService(req.user.userId);
  success(res, 'User profile retrieved', user);
});

const changeInitialCredentials = withErrorHandling(async (req, res) => {
  const result = await changeInitialCredentialsService(
    req.user.userId,
    req.validated.body
  );
  success(res, result.message);
});

const refreshToken = withErrorHandling(async (req, res) => {
  const { refreshToken: raw } = req.validated.body;
  const result = await refreshTokenService(raw);
  success(res, 'Token refreshed successfully', result);
});

const logout = withErrorHandling(async (req, res) => {
  const { refreshToken: raw } = req.validated.body;
  const result = await logoutService(raw);
  success(res, result.message);
});

module.exports = {
  login,
  verifyInvite,
  setPassword,
  forgotPassword,
  resetPassword,
  getMe,
  changeInitialCredentials,
  refreshToken,
  logout,
};
