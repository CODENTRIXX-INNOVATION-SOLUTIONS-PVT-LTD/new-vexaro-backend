'use strict';

const { z } = require('zod/v4');
const { emailSchema, passwordSchema } = require('../common/base.schemas');

const tokenSchema = z.string().trim().min(16).max(4096);
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
const setPasswordSchema = z.object({ token: tokenSchema, password: passwordSchema });
const forgotPasswordSchema = z.object({ email: emailSchema });
const resetPasswordSchema = setPasswordSchema;
const changeInitialCredentialsSchema = z.object({ newEmail: emailSchema, newPassword: passwordSchema });
const verifyInviteQuerySchema = z.object({ token: tokenSchema });
const refreshTokenSchema = z.object({ refreshToken: tokenSchema });

module.exports = {
  loginSchema,
  setPasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changeInitialCredentialsSchema,
  verifyInviteQuerySchema,
  refreshTokenSchema,
  passwordSchema,
};
