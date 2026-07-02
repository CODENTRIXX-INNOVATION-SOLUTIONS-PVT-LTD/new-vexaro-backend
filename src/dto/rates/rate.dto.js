const { z } = require('zod/v4');
const { ShipmentServiceType } = require('../../constants');
const { mongoIdSchema } = require('../../utils/validation');

const createRateCardDto = z.object({
  name:        z.string().min(1).trim(),
  description: z.string().trim().optional(),
  serviceType: z.enum(Object.values(ShipmentServiceType)),
  weightSlabs: z.array(z.object({
    upToKg:    z.number().positive(),
    ratePerKg: z.number().min(0),
    baseRate:  z.number().min(0).optional(),
  })).min(1, 'At least one weight slab required'),
  codCharge:               z.number().min(0).optional(),
  codPercent:              z.number().min(0).max(100).optional(),
  fuelSurcharge:           z.number().min(0).max(100).optional(),
  superAdminMarkupPercent: z.number().min(0).optional(),
});

const updateRateCardDto = createRateCardDto.partial();

const createMarginConfigDto = z.object({
  rateCardId:    mongoIdSchema,
  marginPercent: z.number().min(0).max(100),
  flatMargin:    z.number().min(0).optional(),
});

const calculateRateDto = z.object({
  weight:      z.number().positive(),
  serviceType: z.enum(Object.values(ShipmentServiceType)),
  isCOD:       z.boolean().optional(),
  codAmount:   z.number().min(0).optional(),
  rateCardId:  mongoIdSchema.optional(),
});

module.exports = { createRateCardDto, updateRateCardDto, createMarginConfigDto, calculateRateDto };
