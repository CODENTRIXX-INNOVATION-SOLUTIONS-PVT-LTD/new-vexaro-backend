const { z } = require('zod/v4');
const { UserRole } = require('../../constants');

// ─── Invite User ───────────────────────────────────────────────────────────────
const inviteUserSchema = z.object({
  firstName:   z.string().min(1, 'First name is required').trim(),
  lastName:    z.string().min(1, 'Last name is required').trim(),
  email:       z.email('Invalid email address').toLowerCase().trim(),
  role: z.enum(
    [UserRole.DISTRIBUTOR, UserRole.MERCHANT, UserRole.WAREHOUSE],
    { error: `Role must be one of: DISTRIBUTOR, MERCHANT, WAREHOUSE` },
  ),
  phone:       z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  warehouse: z.object({
    address:       z.string().min(1, 'Warehouse address is required').trim(),
    pincode:       z.string().length(6, 'Warehouse pincode must be 6 digits').trim(),
    city:          z.string().min(1, 'Warehouse city is required').trim(),
    state:         z.string().min(2, 'Warehouse state is required').trim(),
    country:       z.string().trim().optional(),
    contactPerson: z.string().min(1, 'Warehouse contact person is required').trim(),
    name:          z.string().trim().optional(),
    gstNo:         z.string().trim().optional(),
  }).optional(),
}).refine(data => {
  if (data.role === UserRole.MERCHANT && !data.warehouse) {
    return false;
  }
  return true;
}, {
  message: 'Warehouse details are required for merchants',
  path: ['warehouse'],
});

// ─── Update User ───────────────────────────────────────────────────────────────
const updateUserSchema = z
  .object({
    firstName:   z.string().min(1, 'First name cannot be empty').trim().optional(),
    lastName:    z.string().min(1, 'Last name cannot be empty').trim().optional(),
    phone:       z.string().trim().optional(),
    companyName: z.string().trim().optional(),
    address:     z.string().trim().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update',
  });

// ─── List Users Query ──────────────────────────────────────────────────────────
const listUsersQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1, 'Page must be at least 1')),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10))
    .pipe(z.number().int().min(1).max(100, 'Limit cannot exceed 100')),
  role:   z.enum([UserRole.DISTRIBUTOR, UserRole.MERCHANT, UserRole.WAREHOUSE]).optional(),
  search: z.string().trim().optional(),
});

const updateWarehouseSchema = z.object({
  address:       z.string().min(1, 'Address cannot be empty').trim().optional(),
  pincode:       z.string().min(4, 'Pincode must be at least 4 digits').trim().optional(),
  city:          z.string().min(1, 'City cannot be empty').trim().optional(),
  state:         z.string().min(2, 'State must be at least 2 characters').trim().optional(),
  contactPerson: z.string().min(1, 'Contact person cannot be empty').trim().optional(),
  isActive:      z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field is required to update',
});

module.exports = {
  inviteUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
  updateWarehouseSchema,
};
