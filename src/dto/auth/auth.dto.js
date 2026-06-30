const { z } = require('zod/v4');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((value) => /[A-Z]/.test(value), 'Password must contain at least one uppercase letter')
  .refine((value) => /[a-z]/.test(value), 'Password must contain at least one lowercase letter')
  .refine((value) => /[0-9]/.test(value), 'Password must contain at least one number');

const loginSchema = z.object({
  email: z.email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password cannot be empty'),
});

const setPasswordSchema = z.object({
  token: z.string().min(1, 'Token cannot be empty'),
  password: passwordSchema,
});

const changeInitialCredentialsSchema = z.object({
  newEmail: z.email('Invalid email'),
  newPassword: passwordSchema,
});

const forgotPasswordSchema = z.object({
  email: z.email('Invalid email address').toLowerCase().trim(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token cannot be empty'),
  password: passwordSchema,
});

module.exports = {
  loginSchema,
  setPasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changeInitialCredentialsSchema,
};
