const { z } = require('zod/v4');

const updateProfileDto = z.object({
  firstName:   z.string().min(1).trim().optional(),
  lastName:    z.string().min(1).trim().optional(),
  phone:       z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  address:     z.string().trim().optional(),
}).refine(d => Object.keys(d).filter(k => d[k] !== undefined).length > 0, { message: 'At least one field required' });

const changePasswordDto = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .refine(p => /[A-Z]/.test(p), 'Must contain uppercase')
    .refine(p => /[a-z]/.test(p), 'Must contain lowercase')
    .refine(p => /[0-9]/.test(p), 'Must contain number'),
});

const createApiKeyDto = z.object({
  name:        z.string().min(1, 'Key name is required').trim(),
  permissions: z.array(z.enum(['READ', 'WRITE', 'WEBHOOK'])).min(1, 'At least one permission required'),
  expiresAt:   z.string().datetime().optional(),
});

const updateNotificationPrefsDto = z.object({
  SHIPMENT: z.boolean().optional(),
  PAYMENT:  z.boolean().optional(),
  DISPUTE:  z.boolean().optional(),
  SYSTEM:   z.boolean().optional(),
  INVITE:   z.boolean().optional(),
}).refine(d => Object.keys(d).filter(k => d[k] !== undefined).length > 0, { message: 'At least one preference required' });

module.exports = { updateProfileDto, changePasswordDto, createApiKeyDto, updateNotificationPrefsDto };
