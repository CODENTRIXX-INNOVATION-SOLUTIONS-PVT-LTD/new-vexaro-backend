'use strict';

const crypto = require('crypto');

// Mock all dependencies before importing the service
jest.mock('../../../src/modules/auth/auth.repository');
jest.mock('../../../src/modules/users/user.repository');
jest.mock('../../../src/utils/email', () => ({
  sendResetEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-32-chars-minimum-len',
    JWT_EXPIRES_IN: '1h',
    RESET_TOKEN_EXPIRES_HOURS: 1,
    FRONTEND_URL: 'http://localhost:3000',
    NODE_ENV: 'test',
  },
}));
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('../../../src/modules/audit/audit.service', () => ({
  logAuditEvent: jest.fn(),
}));
jest.mock('../../../src/modules/finance/finance.service', () => ({
  createWalletService: jest.fn().mockResolvedValue({ id: 'wallet-123' }),
}));

const authRepository = require('../../../src/modules/auth/auth.repository');
const userRepository = require('../../../src/modules/users/user.repository');
const { sendResetEmail } = require('../../../src/utils/email');
const logger = require('../../../src/utils/logger');
const { logAuditEvent } = require('../../../src/modules/audit/audit.service');
const { createWalletService } = require('../../../src/modules/finance/finance.service');

const {
  loginService,
  refreshTokenService,
  logoutService,
  verifyInviteService,
  setPasswordService,
  forgotPasswordService,
  resetPasswordService,
  getMeService,
  changeInitialCredentialsService,
} = require('../../../src/modules/auth/auth.service');

describe('auth.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // R17.1-4: loginService tests
  // ──────────────────────────────────────────────────────────────────────────
  describe('loginService', () => {
    const mockUser = {
      _id: 'user-123',
      email: 'test@example.com',
      role: 'MERCHANT',
      isActive: true,
      firstName: 'John',
      lastName: 'Doe',
      mustChangeCredentials: false,
      passwordHash: '$2a$12$hashedhash',
      lastLoginAt: null,
      comparePassword: jest.fn(),
      getPublicProfile: jest.fn().mockReturnValue({
        id: 'user-123',
        email: 'test@example.com',
        role: 'MERCHANT',
        firstName: 'John',
        lastName: 'Doe',
      }),
    };

    it('R17.1: returns accessToken, refreshToken, and user profile on successful login', async () => {
      mockUser.comparePassword.mockResolvedValue(true);
      authRepository.findUserByEmail = jest.fn().mockResolvedValue(mockUser);
      authRepository.saveUser = jest.fn().mockResolvedValue(mockUser);
      authRepository.createRefreshToken = jest.fn().mockResolvedValue({ _id: 'token-123' });

      const result = await loginService({ email: 'test@example.com', password: 'password123' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('test@example.com');
      expect(result).toHaveProperty('token'); // backwards-compat
      expect(authRepository.findUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockUser.comparePassword).toHaveBeenCalledWith('password123');
      expect(authRepository.saveUser).toHaveBeenCalledWith(mockUser);
      expect(logger.info).toHaveBeenCalledWith('auth_login_success', expect.any(Object));
    });

    it('R17.2: throws 401 when user is not found', async () => {
      authRepository.findUserByEmail = jest.fn().mockResolvedValue(null);

      await expect(
        loginService({ email: 'notfound@example.com', password: 'password123' })
      ).rejects.toMatchObject({
        message: 'Invalid email or password',
        statusCode: 401,
      });

      expect(logger.warn).toHaveBeenCalledWith('auth_login_failed', expect.objectContaining({
        email: 'notfound@example.com',
        reason: 'user_not_found',
      }));
    });

    it('R17.3: throws 401 when account is not active', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      authRepository.findUserByEmail = jest.fn().mockResolvedValue(inactiveUser);

      await expect(
        loginService({ email: 'test@example.com', password: 'password123' })
      ).rejects.toMatchObject({
        message: 'Account not activated. Please check your invite email to set a password.',
        statusCode: 401,
      });

      expect(logger.warn).toHaveBeenCalledWith('auth_login_failed', expect.objectContaining({
        reason: 'account_not_activated',
      }));
    });

    it('R17.4: throws 401 when password is incorrect', async () => {
      mockUser.comparePassword.mockResolvedValue(false);
      authRepository.findUserByEmail = jest.fn().mockResolvedValue(mockUser);

      await expect(
        loginService({ email: 'test@example.com', password: 'wrongpassword' })
      ).rejects.toMatchObject({
        message: 'Invalid email or password',
        statusCode: 401,
      });

      expect(logger.warn).toHaveBeenCalledWith('auth_login_failed', expect.objectContaining({
        reason: 'wrong_password',
      }));
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // R17.5-7: refreshTokenService tests
  // ──────────────────────────────────────────────────────────────────────────
  describe('refreshTokenService', () => {
    const mockUser = {
      _id: 'user-123',
      email: 'test@example.com',
      role: 'MERCHANT',
      isActive: true,
    };

    const validToken = 'a'.repeat(128); // 128-char hex string
    const tokenHash = crypto.createHash('sha256').update(validToken).digest('hex');

    it('R17.5: successfully rotates tokens and returns new accessToken and refreshToken', async () => {
      const storedToken = {
        _id: 'token-123',
        userId: 'user-123',
        tokenHash,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      authRepository.findRefreshTokenByHash = jest.fn().mockResolvedValue(storedToken);
      userRepository.findOne = jest.fn().mockResolvedValue(mockUser);
      authRepository.revokeRefreshToken = jest.fn().mockResolvedValue(undefined);
      authRepository.createRefreshToken = jest.fn().mockResolvedValue({ _id: 'new-token-123' });

      const result = await refreshTokenService(validToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(authRepository.findRefreshTokenByHash).toHaveBeenCalledWith(tokenHash);
      expect(authRepository.revokeRefreshToken).toHaveBeenCalledWith('token-123');
      expect(authRepository.createRefreshToken).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('auth_token_refreshed', expect.any(Object));
    });

    it('R17.6: throws 401 when refresh token is revoked', async () => {
      const revokedToken = {
        _id: 'token-123',
        userId: 'user-123',
        tokenHash,
        isRevoked: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      authRepository.findRefreshTokenByHash = jest.fn().mockResolvedValue(revokedToken);

      await expect(refreshTokenService(validToken)).rejects.toMatchObject({
        message: 'Refresh token has been revoked',
        statusCode: 401,
      });
    });

    it('R17.7: throws 401 when refresh token is expired', async () => {
      const expiredToken = {
        _id: 'token-123',
        userId: 'user-123',
        tokenHash,
        isRevoked: false,
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      };

      authRepository.findRefreshTokenByHash = jest.fn().mockResolvedValue(expiredToken);

      await expect(refreshTokenService(validToken)).rejects.toMatchObject({
        message: 'Refresh token has expired',
        statusCode: 401,
      });
    });

    it('throws 401 when refresh token is not found', async () => {
      authRepository.findRefreshTokenByHash = jest.fn().mockResolvedValue(null);

      await expect(refreshTokenService(validToken)).rejects.toMatchObject({
        message: 'Invalid refresh token',
        statusCode: 401,
      });
    });

    it('throws 400 when token is missing', async () => {
      await expect(refreshTokenService(null)).rejects.toMatchObject({
        message: 'Refresh token is required',
        statusCode: 400,
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // R17.8-9: logoutService tests
  // ──────────────────────────────────────────────────────────────────────────
  describe('logoutService', () => {
    const validToken = 'b'.repeat(128);
    const tokenHash = crypto.createHash('sha256').update(validToken).digest('hex');

    it('R17.8: successfully revokes token and returns success message', async () => {
      authRepository.revokeRefreshTokenByHash = jest.fn().mockResolvedValue({
        _id: 'token-123',
        userId: 'user-123',
      });

      const result = await logoutService(validToken);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(authRepository.revokeRefreshTokenByHash).toHaveBeenCalledWith(tokenHash);
      expect(logger.info).toHaveBeenCalledWith('auth_logout', { userId: 'user-123' });
    });

    it('R17.9: throws 400 when no token is provided', async () => {
      await expect(logoutService(null)).rejects.toMatchObject({
        message: 'Refresh token is required',
        statusCode: 400,
      });

      await expect(logoutService('')).rejects.toMatchObject({
        message: 'Refresh token is required',
        statusCode: 400,
      });
    });

    it('returns success message even if token is not found', async () => {
      authRepository.revokeRefreshTokenByHash = jest.fn().mockResolvedValue(null);

      const result = await logoutService(validToken);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(logger.info).not.toHaveBeenCalled(); // no userId when token not found
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // R17.10-12: verifyInviteService tests
  // ──────────────────────────────────────────────────────────────────────────
  describe('verifyInviteService', () => {
    const validToken = 'invite-token-123';
    const tokenHash = crypto.createHash('sha256').update(validToken).digest('hex');

    it('R17.10: returns user details for valid unexpired invite token', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'invited@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'MERCHANT',
        isActive: false,
        inviteTokenHash: tokenHash,
        inviteTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      authRepository.findUserByInviteTokenHash = jest.fn().mockResolvedValue(mockUser);

      const result = await verifyInviteService(validToken);

      expect(result).toEqual({
        name: 'Jane Doe',
        email: 'invited@example.com',
        role: 'MERCHANT',
        firstName: 'Jane',
      });
      expect(authRepository.findUserByInviteTokenHash).toHaveBeenCalledWith(tokenHash);
    });

    it('R17.11: throws 410 when invite token is expired', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'invited@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'MERCHANT',
        isActive: false,
        inviteTokenHash: tokenHash,
        inviteTokenExpiry: new Date(Date.now() - 1000), // expired
      };

      authRepository.findUserByInviteTokenHash = jest.fn().mockResolvedValue(mockUser);

      await expect(verifyInviteService(validToken)).rejects.toMatchObject({
        message: 'Invite link has expired. Please contact your account manager for a new invite.',
        statusCode: 410,
      });
    });

    it('R17.12: throws 409 when invite has already been used (user is active)', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'invited@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'MERCHANT',
        isActive: true, // already active
        inviteTokenHash: tokenHash,
        inviteTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      authRepository.findUserByInviteTokenHash = jest.fn().mockResolvedValue(mockUser);

      await expect(verifyInviteService(validToken)).rejects.toMatchObject({
        message: 'This invite has already been used. Please sign in instead.',
        statusCode: 409,
      });
    });

    it('throws 400 when user is not found', async () => {
      authRepository.findUserByInviteTokenHash = jest.fn().mockResolvedValue(null);

      await expect(verifyInviteService(validToken)).rejects.toMatchObject({
        message: 'Invalid invite token',
        statusCode: 400,
      });
    });

    it('throws 400 when token is missing', async () => {
      await expect(verifyInviteService(null)).rejects.toMatchObject({
        message: 'Invite token is required',
        statusCode: 400,
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // R17.13: setPasswordService tests
  // ──────────────────────────────────────────────────────────────────────────
  describe('setPasswordService', () => {
    const validToken = 'invite-token-456';
    const tokenHash = crypto.createHash('sha256').update(validToken).digest('hex');

    it('R17.13: activates user, sets password, and returns session', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'newuser@example.com',
        firstName: 'Bob',
        lastName: 'Smith',
        role: 'MERCHANT',
        isActive: false,
        mustChangeCredentials: false,
        inviteTokenHash: tokenHash,
        inviteTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
        getPublicProfile: jest.fn().mockReturnValue({
          id: 'user-123',
          email: 'newuser@example.com',
          role: 'MERCHANT',
          firstName: 'Bob',
          lastName: 'Smith',
        }),
      };

      authRepository.findUserByInviteTokenHash = jest.fn().mockResolvedValue(mockUser);
      authRepository.saveUser = jest.fn().mockResolvedValue(mockUser);
      authRepository.createRefreshToken = jest.fn().mockResolvedValue({ _id: 'refresh-123' });

      const result = await setPasswordService({
        token: validToken,
        password: 'newPassword123!',
      });

      expect(mockUser.isActive).toBe(true);
      expect(mockUser.passwordHash).toBeDefined();
      expect(mockUser.inviteTokenHash).toBeUndefined();
      expect(mockUser.inviteTokenExpiry).toBeUndefined();
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(authRepository.saveUser).toHaveBeenCalledWith(mockUser);
      expect(logAuditEvent).toHaveBeenCalled();
      expect(createWalletService).toHaveBeenCalledWith('user-123');
    });

    it('throws 400 when user is not found', async () => {
      authRepository.findUserByInviteTokenHash = jest.fn().mockResolvedValue(null);

      await expect(
        setPasswordService({ token: validToken, password: 'newPassword123!' })
      ).rejects.toMatchObject({
        message: 'Invalid invite token',
        statusCode: 400,
      });
    });

    it('throws 410 when invite token is expired', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'newuser@example.com',
        isActive: false,
        inviteTokenHash: tokenHash,
        inviteTokenExpiry: new Date(Date.now() - 1000), // expired
      };

      authRepository.findUserByInviteTokenHash = jest.fn().mockResolvedValue(mockUser);

      await expect(
        setPasswordService({ token: validToken, password: 'newPassword123!' })
      ).rejects.toMatchObject({
        message: 'Invite link has expired. Please contact your account manager for a new invite.',
        statusCode: 410,
      });
    });

    it('throws 409 when invite has already been used', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'newuser@example.com',
        isActive: true, // already active
        inviteTokenHash: tokenHash,
        inviteTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      authRepository.findUserByInviteTokenHash = jest.fn().mockResolvedValue(mockUser);

      await expect(
        setPasswordService({ token: validToken, password: 'newPassword123!' })
      ).rejects.toMatchObject({
        message: 'This invite has already been used. Please sign in instead.',
        statusCode: 409,
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // R17.14-15: forgotPasswordService tests
  // ──────────────────────────────────────────────────────────────────────────
  describe('forgotPasswordService', () => {
    it('R17.14: sends reset email for registered active user', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'registered@example.com',
        firstName: 'Alice',
        isActive: true,
        deletedAt: null,
      };

      userRepository.findOne = jest.fn().mockResolvedValue(mockUser);
      authRepository.setResetToken = jest.fn().mockResolvedValue(undefined);

      const result = await forgotPasswordService({ email: 'registered@example.com' });

      expect(result).toEqual({ message: 'If that email exists, a reset link has been sent.' });
      expect(userRepository.findOne).toHaveBeenCalledWith({
        email: 'registered@example.com',
        isActive: true,
        deletedAt: null,
      });
      expect(authRepository.setResetToken).toHaveBeenCalled();
      expect(sendResetEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'registered@example.com',
          firstName: 'Alice',
          resetToken: expect.any(String),
        })
      );
    });

    it('R17.15: returns generic message for unknown email without throwing', async () => {
      userRepository.findOne = jest.fn().mockResolvedValue(null);

      const result = await forgotPasswordService({ email: 'unknown@example.com' });

      expect(result).toEqual({ message: 'If that email exists, a reset link has been sent.' });
      expect(authRepository.setResetToken).not.toHaveBeenCalled();
      expect(sendResetEmail).not.toHaveBeenCalled();
    });

    it('does not throw if sendResetEmail fails', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'registered@example.com',
        firstName: 'Alice',
        isActive: true,
        deletedAt: null,
      };

      userRepository.findOne = jest.fn().mockResolvedValue(mockUser);
      authRepository.setResetToken = jest.fn().mockResolvedValue(undefined);
      sendResetEmail.mockRejectedValueOnce(new Error('Email service down'));

      const result = await forgotPasswordService({ email: 'registered@example.com' });

      expect(result).toEqual({ message: 'If that email exists, a reset link has been sent.' });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // R17.16-17: resetPasswordService tests
  // ──────────────────────────────────────────────────────────────────────────
  describe('resetPasswordService', () => {
    const validToken = 'reset-token-789';
    const tokenHash = crypto.createHash('sha256').update(validToken).digest('hex');

    it('R17.16: successfully resets password with valid unexpired token', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'user@example.com',
        resetTokenHash: tokenHash,
        resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        passwordHash: 'old-hash',
      };

      authRepository.findUserByResetTokenHash = jest.fn().mockResolvedValue(mockUser);
      authRepository.saveUser = jest.fn().mockResolvedValue(mockUser);

      const result = await resetPasswordService({
        token: validToken,
        password: 'newSecurePassword123!',
      });

      expect(result).toEqual({
        message: 'Password reset successfully. You can now sign in.',
      });
      expect(mockUser.passwordHash).toBeDefined();
      expect(mockUser.passwordHash).not.toBe('old-hash');
      expect(mockUser.resetTokenHash).toBeUndefined();
      expect(mockUser.resetTokenExpiry).toBeUndefined();
      expect(authRepository.saveUser).toHaveBeenCalledWith(mockUser);
    });

    it('R17.17: throws 410 when reset token is expired', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'user@example.com',
        resetTokenHash: tokenHash,
        resetTokenExpiry: new Date(Date.now() - 1000), // expired
      };

      authRepository.findUserByResetTokenHash = jest.fn().mockResolvedValue(mockUser);

      await expect(
        resetPasswordService({ token: validToken, password: 'newPassword123!' })
      ).rejects.toMatchObject({
        message: 'Reset link has expired. Please request a new one.',
        statusCode: 410,
      });
    });

    it('throws 400 when user is not found with reset token', async () => {
      authRepository.findUserByResetTokenHash = jest.fn().mockResolvedValue(null);

      await expect(
        resetPasswordService({ token: validToken, password: 'newPassword123!' })
      ).rejects.toMatchObject({
        message: 'Invalid or expired reset token',
        statusCode: 400,
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // R17.18-19: getMeService tests
  // ──────────────────────────────────────────────────────────────────────────
  describe('getMeService', () => {
    it('R17.18: returns user public profile when user is found', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'me@example.com',
        role: 'MERCHANT',
        firstName: 'Current',
        lastName: 'User',
        getPublicProfile: jest.fn().mockReturnValue({
          id: 'user-123',
          email: 'me@example.com',
          role: 'MERCHANT',
          firstName: 'Current',
          lastName: 'User',
        }),
      };

      userRepository.findOne = jest.fn().mockResolvedValue(mockUser);

      const result = await getMeService('user-123');

      expect(result).toEqual({
        id: 'user-123',
        email: 'me@example.com',
        role: 'MERCHANT',
        firstName: 'Current',
        lastName: 'User',
      });
      expect(userRepository.findOne).toHaveBeenCalledWith({
        _id: 'user-123',
        deletedAt: null,
      });
    });

    it('R17.19: throws 404 when user is not found', async () => {
      userRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(getMeService('user-nonexistent')).rejects.toMatchObject({
        message: 'User not found',
        statusCode: 404,
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // R17.20-21: changeInitialCredentialsService tests
  // ──────────────────────────────────────────────────────────────────────────
  describe('changeInitialCredentialsService', () => {
    it('R17.20: throws 400 when mustChangeCredentials flag is false', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'user@example.com',
        mustChangeCredentials: false, // flag is false
      };

      authRepository.findUserByIdWithPassword = jest.fn().mockResolvedValue(mockUser);

      await expect(
        changeInitialCredentialsService('user-123', {
          newEmail: 'newemail@example.com',
          newPassword: 'newPassword123!',
        })
      ).rejects.toMatchObject({
        message: 'Credentials already updated',
        statusCode: 400,
      });
    });

    it('R17.21: throws 409 when new email is already taken by another user', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'olduser@example.com',
        mustChangeCredentials: true,
      };

      const existingUser = {
        _id: 'other-user',
        email: 'taken@example.com',
      };

      authRepository.findUserByIdWithPassword = jest.fn().mockResolvedValue(mockUser);
      userRepository.findOne = jest.fn().mockResolvedValue(existingUser);

      await expect(
        changeInitialCredentialsService('user-123', {
          newEmail: 'TAKEN@example.com', // case-insensitive
          newPassword: 'newPassword123!',
        })
      ).rejects.toMatchObject({
        message: 'Email already exists',
        statusCode: 409,
      });
    });

    it('R17.21: successfully updates credentials when valid', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'olduser@example.com',
        mustChangeCredentials: true,
        passwordHash: 'old-hash',
      };

      authRepository.findUserByIdWithPassword = jest.fn().mockResolvedValue(mockUser);
      userRepository.findOne = jest.fn().mockResolvedValue(null); // no conflict
      authRepository.saveUser = jest.fn().mockResolvedValue(mockUser);

      const result = await changeInitialCredentialsService('user-123', {
        newEmail: 'newuser@example.com',
        newPassword: 'newSecurePassword123!',
      });

      expect(result).toEqual({ message: 'Credentials updated successfully' });
      expect(mockUser.email).toBe('newuser@example.com');
      expect(mockUser.passwordHash).toBeDefined();
      expect(mockUser.passwordHash).not.toBe('old-hash');
      expect(mockUser.mustChangeCredentials).toBe(false);
      expect(authRepository.saveUser).toHaveBeenCalledWith(mockUser);
    });

    it('throws 404 when user is not found', async () => {
      authRepository.findUserByIdWithPassword = jest.fn().mockResolvedValue(null);

      await expect(
        changeInitialCredentialsService('user-nonexistent', {
          newEmail: 'new@example.com',
          newPassword: 'newPassword123!',
        })
      ).rejects.toMatchObject({
        message: 'User not found',
        statusCode: 404,
      });
    });
  });
});
