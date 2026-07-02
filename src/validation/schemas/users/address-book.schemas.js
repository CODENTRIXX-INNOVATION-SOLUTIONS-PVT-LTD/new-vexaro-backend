'use strict';

const { z } = require('zod/v4');
const { emailSchema, phoneSchema, pincodeSchema, objectIdSchema } = require('../common/base.schemas');

// Address label enum
const addressLabels = ['Home', 'Office', 'Store', 'Warehouse', 'Customer', 'Other'];

// Create address schema with all required fields and validations
const createAddressSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  addressLine: z.string().trim().min(1, 'Address line is required').max(200, 'Address line cannot exceed 200 characters'),
  city: z.string().trim().min(1, 'City is required').max(50, 'City cannot exceed 50 characters'),
  state: z.string().trim().min(1, 'State is required').max(50, 'State cannot exceed 50 characters'),
  pincode: pincodeSchema,
  country: z.string().trim().max(50, 'Country cannot exceed 50 characters').default('India'),
  label: z.enum(addressLabels, { errorMap: () => ({ message: 'Label must be one of: Home, Office, Store, Warehouse, Customer, Other' }) }).default('Other'),
});

// Update address schema - all fields optional (partial of create schema)
const updateAddressSchema = createAddressSchema.partial();

// List addresses query schema with pagination and filtering
const listAddressQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  pageSize: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 20)),
  label: z.enum(addressLabels).optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

// Address ID params schema for route parameters
const addressIdParamsSchema = z.object({
  id: objectIdSchema,
});

module.exports = {
  createAddressSchema,
  updateAddressSchema,
  listAddressQuerySchema,
  addressIdParamsSchema,
  addressLabels,
};
