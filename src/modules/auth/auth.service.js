'use strict';

const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const authRepository = require('./auth.repository');
const userRepository = require('../users/user.repository');
const {
  generateToken,
  hashToken,
  tokenExpiry,
  roleToDashboardPath,
} = require('../../utils');
const { sendResetEmail } = require('../../utils/email');
const { env }   = require('../../config/env');
const logger    = require('../../utils/logger');

// ─── Refresh token helpers ─────────────────────────────────────────────────────
const REFRESH_TOKEN_BYTES  = 64;          // 64 random bytes → 128-char hex string
const REFRESH_TOKEN_DAYS   = 30;
const ACCESS_TOKEN_EXPIRY  = '1h';        // always 1 h for access tokens
const SALT_ROUNDS          = 12;

/** Issue a short-lived JWT access token (always 1 h, ignores JWT_EXPIRES_IN). */
const issueAccessToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );

/** Generate raw refresh token, persist its hash, return the raw string. */
const issueRefreshToken = async (userId) => {
  const raw       = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await authRepository.createRefreshToken({ userId, tokenHash, expiresAt });
  return raw;
};

const createSession = async (user) => {
  const accessToken  = issueAccessToken(user);
  const refreshToken = await issueRefreshToken(user._id);

  return {
    token: accessToken,           // keep 'token' key for backwards-compat
    accessToken,
    refreshToken,
    user: user.getPublicProfile(),
    mustChangeCredentials: user.mustChangeCredentials,
    redirectTo: user.mustChangeCredentials
      ? '/change-credentials'
      : roleToDashboardPath(user.role),
  };
};

const loginService = async (dto) => {
  const user = await authRepository.findUserByEmail(dto.email);

  if (!user) {
    logger.warn('auth_login_failed', { email: dto.email, reason: 'user_not_found' });
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }
  if (!user.isActive) {
    logger.warn('auth_login_failed', { email: dto.email, userId: user._id, reason: 'account_not_activated' });
    throw Object.assign(
      new Error('Account not activated. Please check your invite email to set a password.'),
      { statusCode: 401 },
    );
  }

  const isMatch = await user.comparePassword(dto.password);
  if (!isMatch) {
    logger.warn('auth_login_failed', { email: dto.email, userId: user._id, reason: 'wrong_password' });
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }

  user.lastLoginAt = new Date();
  await authRepository.saveUser(user);

  logger.info('auth_login_success', {
    userId: user._id,
    email:  user.email,
    role:   user.role,
  });

  return createSession(user);
};

// ─── Refresh Token service ─────────────────────────────────────────────────────
const refreshTokenService = async (rawToken) => {
  if (!rawToken || typeof rawToken !== 'string') {
    throw Object.assign(new Error('Refresh token is required'), { statusCode: 400 });
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const stored    = await authRepository.findRefreshTokenByHash(tokenHash);

  if (!stored) {
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
  }
  if (stored.isRevoked) {
    throw Object.assign(new Error('Refresh token has been revoked'), { statusCode: 401 });
  }
  if (stored.expiresAt < new Date()) {
    throw Object.assign(new Error('Refresh token has expired'), { statusCode: 401 });
  }

  const user = await userRepository.findOne({ _id: stored.userId, deletedAt: null });
  if (!user || !user.isActive) {
    throw Object.assign(new Error('User account is not active'), { statusCode: 401 });
  }

  // Revoke old token (rotation)
  await authRepository.revokeRefreshToken(stored._id);

  // Issue new pair
  const accessToken     = issueAccessToken(user);
  const newRefreshToken = await issueRefreshToken(user._id);

  logger.info('auth_token_refreshed', { userId: user._id, email: user.email });

  return { accessToken, refreshToken: newRefreshToken };
};

// ─── Logout service ────────────────────────────────────────────────────────────
const logoutService = async (rawToken) => {
  if (!rawToken || typeof rawToken !== 'string') {
    throw Object.assign(new Error('Refresh token is required'), { statusCode: 400 });
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const result    = await authRepository.revokeRefreshTokenByHash(tokenHash);

  if (result) {
    logger.info('auth_logout', { userId: result.userId });
  }

  return { message: 'Logged out successfully' };
};

const verifyInviteService = async (token) => {
  if (!token) {
    throw Object.assign(new Error('Invite token is required'), { statusCode: 400 });
  }

  const user = await authRepository.findUserByInviteTokenHash(hashToken(token));
  if (!user) {
    throw Object.assign(new Error('Invalid invite token'), { statusCode: 400 });
  }
  if (!user.inviteTokenExpiry || user.inviteTokenExpiry < new Date()) {
    throw Object.assign(
      new Error('Invite link has expired. Please contact your account manager for a new invite.'),
      { statusCode: 410 },
    );
  }
  if (user.isActive) {
    throw Object.assign(
      new Error('This invite has already been used. Please sign in instead.'),
      { statusCode: 409 },
    );
  }

  return {
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
  };
};

const setPasswordService = async (dto) => {
  const user = await authRepository.findUserByInviteTokenHash(hashToken(dto.token));

  if (!user) {
    throw Object.assign(new Error('Invalid invite token'), { statusCode: 400 });
  }
  if (!user.inviteTokenExpiry || user.inviteTokenExpiry < new Date()) {
    throw Object.assign(
      new Error('Invite link has expired. Please contact your account manager for a new invite.'),
      { statusCode: 410 },
    );
  }
  if (user.isActive) {
    throw Object.assign(
      new Error('This invite has already been used. Please sign in instead.'),
      { statusCode: 409 },
    );
  }

  user.passwordHash      = await bcrypt.hash(dto.password, SALT_ROUNDS);
  user.isActive          = true;
  user.inviteTokenHash   = undefined;
  user.inviteTokenExpiry = undefined;
  user.lastLoginAt       = new Date();
  await authRepository.saveUser(user);

  const { logAuditEvent } = require('../audit/audit.service');
  logAuditEvent(user._id, 'MERCHANT_ACTIVATED', { email: user.email }, user._id);

  // Hook wallet auto-creation for safety/backward compatibility
  const { UserRole } = require('../../constants');
  if (user.role === UserRole.DISTRIBUTOR || user.role === UserRole.MERCHANT) {
    const { createWalletService } = require('../finance/finance.service');
    try {
      await createWalletService(user._id);
    } catch (walletErr) {
      console.error('Failed to auto-create wallet in setPasswordService:', walletErr);
    }
  }

  return await createSession(user);
};

const forgotPasswordService = async (dto) => {
  const user = await userRepository.findOne({
    email: dto.email,
    isActive: true,
    deletedAt: null,
  });
  const message = 'If that email exists, a reset link has been sent.';
  if (!user) return { message };

  const resetToken = generateToken();
  await authRepository.setResetToken(
    user._id,
    hashToken(resetToken),
    tokenExpiry(env.RESET_TOKEN_EXPIRES_HOURS),
  );

  try {
    await sendResetEmail({
      to: user.email,
      firstName: user.firstName,
      resetToken,
    });
  } catch (emailError) {
    console.error('Failed to send reset email:', emailError);
    if (env.NODE_ENV === 'development') {
      console.log(
        `Reset URL: ${env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`,
      );
    }
  }

  return { message };
};

const resetPasswordService = async (dto) => {
  const user = await authRepository.findUserByResetTokenHash(hashToken(dto.token));

  if (!user) {
    throw Object.assign(new Error('Invalid or expired reset token'), { statusCode: 400 });
  }
  if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    throw Object.assign(
      new Error('Reset link has expired. Please request a new one.'),
      { statusCode: 410 },
    );
  }

  user.passwordHash    = await bcrypt.hash(dto.password, SALT_ROUNDS);
  user.resetTokenHash  = undefined;
  user.resetTokenExpiry = undefined;
  await authRepository.saveUser(user);

  return { message: 'Password reset successfully. You can now sign in.' };
};

const getMeService = async (userId) => {
  const user = await userRepository.findOne({ _id: userId, deletedAt: null });
  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }
  return user.getPublicProfile();
};

const changeInitialCredentialsService = async (userId, dto) => {
  const userWithPassword = await authRepository.findUserByIdWithPassword(userId);

  if (!userWithPassword) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }
  if (!userWithPassword.mustChangeCredentials) {
    throw Object.assign(new Error('Credentials already updated'), { statusCode: 400 });
  }

  const existingEmail = await userRepository.findOne({
    email: dto.newEmail.toLowerCase(),
    _id: { $ne: userId },
  });
  if (existingEmail) {
    throw Object.assign(new Error('Email already exists'), { statusCode: 409 });
  }

  userWithPassword.email                = dto.newEmail.toLowerCase();
  userWithPassword.passwordHash         = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
  userWithPassword.mustChangeCredentials = false;

  await authRepository.saveUser(userWithPassword);

  return { message: 'Credentials updated successfully' };
};

module.exports = {
  loginService,
  refreshTokenService,
  logoutService,
  verifyInviteService,
  setPasswordService,
  forgotPasswordService,
  resetPasswordService,
  getMeService,
  changeInitialCredentialsService,
};
