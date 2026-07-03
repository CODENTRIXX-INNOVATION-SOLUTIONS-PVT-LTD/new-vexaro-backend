'use strict';

const { z } = require('zod/v4');
const { UserRole } = require('../../../constants');
const legacy = require('../../../dto/users/user.dto');
const { emailSchema, phoneSchema, pincodeSchema, objectIdSchema } = require('../common/base.schemas');

const warehouseSchema = z.object({
  address: z.string().trim().min(5).max(300),
  pincode: pincodeSchema,
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(2).max(80),
  country: z.string().trim().max(80).default('India'),
  contactPerson: z.string().trim().min(1).max(120),
  name: z.string().trim().max(120).optional(),
  gstNo: z.string().trim().max(20).optional(),
});
const inviteUserSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: emailSchema,
  role: z.enum([UserRole.DISTRIBUTOR, UserRole.MERCHANT, UserRole.WAREHOUSE]),
  phone: phoneSchema.optional(),
  companyName: z.string().trim().max(150).optional(),
  warehouse: warehouseSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.role === UserRole.MERCHANT && !data.warehouse) {
    ctx.addIssue({ code: 'custom', path: ['warehouse'], message: 'Warehouse details are required for merchants' });
  }
  if (data.role === UserRole.MERCHANT && !data.phone) {
    ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Phone number is required for merchant warehouse creation' });
  }
  if (data.role !== UserRole.MERCHANT && data.warehouse) {
    ctx.addIssue({ code: 'custom', path: ['warehouse'], message: 'Warehouse details are only allowed for merchants' });
  }
});
const updateUserSchema = legacy.updateUserSchema;
const listUsersQuerySchema = legacy.listUsersQuerySchema;
const updateWarehouseSchema = legacy.updateWarehouseSchema;
const userIdParamsSchema = z.object({ id: objectIdSchema });
const addressBookSchemas = require('./address-book.schemas');
const warehouseSchemas = require('./warehouse.schemas');

module.exports = {
  inviteUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
  updateWarehouseSchema,
  warehouseSchema,
  userIdParamsSchema,
  ...addressBookSchemas,
  ...warehouseSchemas,
};
