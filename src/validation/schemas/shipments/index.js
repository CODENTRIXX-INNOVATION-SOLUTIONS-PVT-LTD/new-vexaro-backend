'use strict';

const { z } = require('zod/v4');
const { ShipmentStatus } = require('../../../constants');
const legacy = require('../../../dto/shipments/shipment.dto');
const { moneySchema, objectIdSchema } = require('../common/base.schemas');

const createShipmentSchema = legacy.createShipmentSchema.safeExtend({
  weight: z.number().positive().max(50, 'Weight cannot exceed 50 kg'),
  length: z.number().positive().max(200).optional(),
  breadth: z.number().positive().max(200).optional(),
  height: z.number().positive().max(200).optional(),
  declaredValue: moneySchema({ min: 0, max: 1000000 }).optional(),
  codAmount: moneySchema({ min: 0, max: 50000 }).optional(),
  merchantId: objectIdSchema.optional(),  // required for SA/Distributor booking on behalf of a merchant
}).superRefine((data, ctx) => {
  // destination must be provided unless destinationAddressBookId is specified
  if (!data.destination && !data.destinationAddressBookId) {
    ctx.addIssue({
      code: 'custom',
      path: ['destination'],
      message: 'destination is required unless destinationAddressBookId is provided',
    });
  }
  const isCOD = String(data.paymentMethod || '').toUpperCase() === 'COD' || data.isCOD === true;
  if (isCOD && (!data.codAmount || data.codAmount <= 0)) {
    ctx.addIssue({ code: 'custom', path: ['codAmount'], message: 'COD amount is required when COD is enabled' });
  }
  if (!isCOD && data.codAmount && data.codAmount > 0) {
    ctx.addIssue({ code: 'custom', path: ['codAmount'], message: 'COD amount is only allowed for COD shipments' });
  }
  if (data.codAmount && data.declaredValue && data.codAmount > data.declaredValue) {
    ctx.addIssue({ code: 'custom', path: ['codAmount'], message: 'COD amount cannot exceed declared value' });
  }
});


const STATUS_TRANSITIONS = Object.freeze({
  [ShipmentStatus.ORDER_CREATED]: [ShipmentStatus.PICKED_UP, ShipmentStatus.CANCELLED],
  [ShipmentStatus.PICKED_UP]: [ShipmentStatus.ARRIVED_AT_HUB],
  [ShipmentStatus.ARRIVED_AT_HUB]: [ShipmentStatus.OUT_FOR_DELIVERY],
  [ShipmentStatus.OUT_FOR_DELIVERY]: [ShipmentStatus.DELIVERED, ShipmentStatus.DELIVERY_FAILED],
  [ShipmentStatus.DELIVERY_FAILED]: [ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.RTO],
  [ShipmentStatus.DELIVERED]: [], [ShipmentStatus.RTO]: [], [ShipmentStatus.CANCELLED]: [],
});
function isShipmentStatusTransitionAllowed(from, to) { return Boolean(STATUS_TRANSITIONS[from]?.includes(to)); }
const statusTransitionSchema = z.object({ from: z.enum(Object.values(ShipmentStatus)), to: z.enum(Object.values(ShipmentStatus)) })
  .refine(({ from, to }) => isShipmentStatusTransitionAllowed(from, to), { path: ['to'], message: 'Invalid shipment status transition' });
const shipmentIdParamsSchema = z.object({ id: objectIdSchema });
const awbParamsSchema = z.object({ awb: z.string().trim().min(6).max(64).regex(/^[A-Za-z0-9_-]+$/).transform((v) => v.toUpperCase()) });
const bulkJobParamsSchema = z.object({ jobId: z.string().trim().regex(/^BULK-\d+-[a-f\d]{8}$/i) });

module.exports = {
  ...legacy,
  createShipmentSchema,
  shipmentIdParamsSchema,
  awbParamsSchema,
  bulkJobParamsSchema,
  STATUS_TRANSITIONS,
  statusTransitionSchema,
  isShipmentStatusTransitionAllowed,
};
