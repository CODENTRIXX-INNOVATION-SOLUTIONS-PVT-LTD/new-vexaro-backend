const { z } = require('zod/v4');
const { mongoIdSchema } = require('../../utils/validation');
const { ShipmentStatus, ShipmentServiceType } = require('../../constants');

// ─── Reusable address schema ───────────────────────────────────────────────────
const addressSchema = z.object({
  name:        z.string().min(1, 'Name is required').trim(),
  phone:       z.string().min(7, 'Phone is required').trim(),
  email:       z.string().email('Email must be valid').trim().optional(),
  addressLine: z.string().min(1, 'Address line is required').trim(),
  city:        z.string().min(1, 'City is required').trim(),
  state:       z.string().min(1, 'State is required').trim(),
  pincode:     z.string().min(4, 'Pincode is required').trim(),
  country:     z.string().trim().optional(),
});

const forwardOrderItemSchema = z.object({
  productName:  z.string().min(1, 'Product name is required').trim(),
  sku:          z.string().min(1, 'SKU is required').trim(),
  quantity:     z.number().int().positive('Quantity must be a positive integer'),
  sellingPrice: z.number().min(0, 'Selling price cannot be negative'),
  discount:     z.number().min(0, 'Discount cannot be negative').optional().default(0),
  tax:          z.number().min(0, 'Tax cannot be negative').optional().default(0),
});

// ─── Create shipment ───────────────────────────────────────────────────────────
const createShipmentSchema = z.object({
  // Address fields — can be auto-populated via address book IDs server-side
  origin:      addressSchema.optional(),
  destination: addressSchema.optional(),

  // Address book integration: provide an addressBookId to auto-populate origin/destination
  originAddressBookId:      mongoIdSchema.optional(),
  destinationAddressBookId: mongoIdSchema.optional(),

  weight:       z.number({ error: 'Weight must be a number' }).positive('Weight must be > 0'),
  length:       z.number().positive().optional(),
  breadth:      z.number().positive().optional(),
  height:       z.number().positive().optional(),

  declaredValue: z.number().min(0).optional(),
  isCOD:         z.boolean().optional(),
  codAmount:     z.number().min(0).optional(),
  paymentMethod: z.enum(['COD', 'PREPAID', 'cod', 'prepaid']).optional(),

  productName:  z.string().trim().optional(),
  sku:          z.string().trim().optional(),
  quantity:     z.number().int().positive().optional(),
  sellingPrice: z.number().min(0).optional(),
  discount:     z.number().min(0).optional(),
  tax:          z.number().min(0).optional(),
  orderItems:   z.array(forwardOrderItemSchema).optional(),

  serviceType: z.enum(Object.values(ShipmentServiceType)).optional(),

  merchantOrderRef: z.string().trim().optional(),
  invoiceNumber:    z.string().trim().optional(),
  notes:            z.string().trim().optional(),

  warehouseId:   mongoIdSchema.optional(),
  distributorId: mongoIdSchema.optional(),
  merchantId:    mongoIdSchema.optional(),

  carrierId: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  const hasSingleItem = Boolean(data.productName || data.sku || data.quantity || data.sellingPrice !== undefined);
  if (hasSingleItem) {
    if (!data.productName) ctx.addIssue({ code: 'custom', path: ['productName'], message: 'Product name is required' });
    if (!data.quantity) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Quantity is required' });
    if (data.sellingPrice === undefined) ctx.addIssue({ code: 'custom', path: ['sellingPrice'], message: 'Selling price is required' });
  }

  const itemSource = data.orderItems?.length
    ? data.orderItems
    : hasSingleItem
      ? [{
        productName:  data.productName,
        sku:          data.sku,
        quantity:     data.quantity,
        sellingPrice: data.sellingPrice,
        discount:     data.discount || 0,
        tax:          data.tax || 0,
      }]
      : [];

  const subTotal = itemSource.reduce((sum, item) => {
    return sum + (Number(item.sellingPrice || 0) * Number(item.quantity || 0)) - Number(item.discount || 0) + Number(item.tax || 0);
  }, 0);
  const paymentMethod = String(data.paymentMethod || (data.isCOD ? 'COD' : 'PREPAID')).toUpperCase();
  if (paymentMethod === 'COD' && data.codAmount !== undefined && data.codAmount > Math.max(subTotal, data.declaredValue || 0)) {
    ctx.addIssue({ code: 'custom', path: ['codAmount'], message: 'COD amount cannot exceed order value' });
  }
});

// ─── Update shipment (non-status fields) ──────────────────────────────────────
const updateShipmentSchema = z
  .object({
    origin:      addressSchema.optional(),
    destination: addressSchema.optional(),
    weight:      z.number().positive().optional(),
    length:      z.number().positive().optional(),
    breadth:     z.number().positive().optional(),
    height:      z.number().positive().optional(),
    declaredValue:    z.number().min(0).optional(),
    isCOD:            z.boolean().optional(),
    codAmount:        z.number().min(0).optional(),
    serviceType:      z.enum(Object.values(ShipmentServiceType)).optional(),
    carrier:          z.string().trim().optional(),
    carrierAWB:       z.string().trim().optional(),
    estimatedDelivery:z.string().datetime().optional(),
    notes:            z.string().trim().optional(),
    merchantOrderRef: z.string().trim().optional(),
    invoiceNumber:    z.string().trim().optional(),
    warehouseId:      mongoIdSchema.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field is required to update',
  });

// ─── Update status ─────────────────────────────────────────────────────────────
const updateStatusSchema = z.object({
  status: z.enum(Object.values(ShipmentStatus), {
    error: `Status must be one of: ${Object.values(ShipmentStatus).join(', ')}`,
  }),
  note: z.string().trim().optional(),
});

// ─── List shipments query ──────────────────────────────────────────────────────
const listShipmentsQuerySchema = z.object({
  page:  z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)).pipe(z.number().int().min(1)),
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 20)).pipe(z.number().int().min(1).max(100)),
  status:       z.enum(Object.values(ShipmentStatus)).optional(),
  isReturn:     z.string().optional().transform((v) => {
    if (v === undefined || v === '') return undefined;
    return ['true', '1', 'yes'].includes(String(v).toLowerCase());
  }).optional(),
  shipmentType: z.enum(['forward', 'return', 'rto']).optional(),
  search:       z.string().trim().optional(),
  merchantId:   mongoIdSchema.optional(),
  merchant:     mongoIdSchema.optional(),
  distributorId:mongoIdSchema.optional(),
  distributor:  mongoIdSchema.optional(),
  warehouseId:  mongoIdSchema.optional(),
  dateFrom:     z.string().optional(),
  dateTo:       z.string().optional(),
  carrier:      z.string().trim().optional(),
});

const shipmentStatsQuerySchema = z.object({
  status:       z.enum(Object.values(ShipmentStatus)).optional(),
  search:       z.string().trim().optional(),
  merchantId:   mongoIdSchema.optional(),
  merchant:     mongoIdSchema.optional(),
  distributorId:mongoIdSchema.optional(),
  distributor:  mongoIdSchema.optional(),
  warehouseId:  mongoIdSchema.optional(),
  dateFrom:     z.string().optional(),
  dateTo:       z.string().optional(),
  carrier:      z.string().trim().optional(),
});

// ─── AWB search query ──────────────────────────────────────────────────────────
const awbSearchSchema = z.object({
  awb: z.string().min(1, 'AWB is required').trim().toUpperCase(),
});

// ─── Serviceability check ──────────────────────────────────────────────────────
const serviceabilitySchema = z.object({
  fromPincode: z
    .string()
    .trim()
    .length(6, 'fromPincode must be exactly 6 digits')
    .regex(/^\d{6}$/, 'fromPincode must contain only digits'),
  toPincode: z
    .string()
    .trim()
    .length(6, 'toPincode must be exactly 6 digits')
    .regex(/^\d{6}$/, 'toPincode must contain only digits'),
  isCOD:     z.boolean().optional().default(false),
  isForward: z.boolean().optional().default(true),
});

// ─── Velocity rates ────────────────────────────────────────────────────────────
const velocityRatesSchema = z.object({
  journeyType: z.enum(['forward', 'return'], {
    error: 'journeyType must be "forward" or "return"',
  }),
  originPincode: z
    .string()
    .trim()
    .length(6, 'originPincode must be exactly 6 digits')
    .regex(/^\d{6}$/, 'originPincode must contain only digits'),
  destinationPincode: z
    .string()
    .trim()
    .length(6, 'destinationPincode must be exactly 6 digits')
    .regex(/^\d{6}$/, 'destinationPincode must contain only digits'),
  deadWeight: z
    .number({ error: 'deadWeight must be a positive number of grams' })
    .positive('deadWeight must be > 0')
    .optional(),
  deadWeightGrams: z
    .number({ error: 'deadWeightGrams must be a positive number of grams' })
    .positive('deadWeightGrams must be > 0')
    .optional(),
  length: z.number().positive('length must be > 0'),
  width:  z.number().positive('width must be > 0'),
  height: z.number().positive('height must be > 0'),
  paymentMethod: z
    .enum(['cod', 'prepaid'], { error: 'paymentMethod must be "cod" or "prepaid"' })
    .optional(),
  shipmentValue: z.number().positive().optional(),
  qcApplicable: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (!data.deadWeight && !data.deadWeightGrams) {
    ctx.addIssue({
      code: 'custom',
      path: ['deadWeight'],
      message: 'deadWeight is required and must be the shipment weight in grams',
    });
  }
  if (data.journeyType === 'forward' && !data.paymentMethod) {
    ctx.addIssue({
      code:    'custom',
      path:    ['paymentMethod'],
      message: 'paymentMethod is required for forward journey',
    });
  }
  if (data.journeyType === 'forward' && data.paymentMethod === 'cod' && !data.shipmentValue) {
    ctx.addIssue({
      code:    'custom',
      path:    ['shipmentValue'],
      message: 'shipmentValue is required when paymentMethod is "cod"',
    });
  }
});

// ─── Reverse (return) shipment order item sub-schema ──────────────────────────
const reverseOrderItemSchema = z.object({
  name:              z.string().min(1, 'Item name is required').trim(),
  sku:               z.string().min(1, 'SKU is required').trim(),
  units:             z.number().int().positive('units must be a positive integer'),
  selling_price:     z.number().min(0),
  discount:          z.number().min(0).optional().default(0),
  tax:               z.number().min(0).optional().default(0),
  qc_enable:         z.boolean().optional().default(false),
  qc_product_name:   z.string().trim().optional(),
  qc_brand:          z.string().trim().optional(),
  qc_product_image:  z.string().url('qc_product_image must be a valid URL').optional(),
});

// ─── Create reverse shipment ───────────────────────────────────────────────────
const createReverseShipmentSchema = z.object({
  orderId:     z.string().trim().optional(),
  orderDate:   z.string().trim().optional(),

  pickupFirstName: z.string().min(1, 'pickupFirstName is required').trim(),
  pickupLastName:  z.string().trim().optional(),
  companyName:     z.string().trim().optional(),
  pickupAddress:   z.string().min(1, 'pickupAddress is required').trim(),
  pickupAddress2:  z.string().trim().optional(),
  pickupCity:      z.string().min(1, 'pickupCity is required').trim(),
  pickupState:     z.string().min(1, 'pickupState is required').trim(),
  pickupCountry:   z.string().trim().optional(),
  pickupPincode:   z.string().length(6, 'pickupPincode must be 6 digits').regex(/^\d{6}$/).trim(),
  pickupEmail:     z.string().email().optional(),
  pickupPhone:     z.string().min(7, 'pickupPhone is required').trim(),
  pickupIsdCode:   z.string().trim().optional(),

  shippingFirstName: z.string().min(1, 'shippingFirstName is required').trim(),
  shippingLastName:  z.string().trim().optional(),
  shippingAddress:   z.string().min(1, 'shippingAddress is required').trim(),
  shippingAddress2:  z.string().trim().optional(),
  shippingCity:      z.string().min(1, 'shippingCity is required').trim(),
  shippingState:     z.string().min(1, 'shippingState is required').trim(),
  shippingCountry:   z.string().trim().optional(),
  shippingPincode:   z.string().length(6, 'shippingPincode must be 6 digits').regex(/^\d{6}$/).trim(),
  shippingEmail:     z.string().email().optional(),
  shippingPhone:     z.string().min(7, 'shippingPhone is required').trim(),
  shippingIsdCode:   z.string().trim().optional(),

  orderItems: z.array(reverseOrderItemSchema).min(1, 'At least one order item is required'),

  subTotal: z.number().min(0),
  paymentMethod: z.enum(['PREPAID', 'prepaid']).optional().default('PREPAID'),
  length:   z.number().positive('length must be > 0'),
  breadth:  z.number().positive('breadth must be > 0'),
  height:   z.number().positive('height must be > 0'),
  weight:   z.number().positive('weight must be > 0'),

  totalDiscount:  z.number().min(0).optional().default(0),
  requestPickup:  z.boolean().optional().default(true),
  warehouseId:    mongoIdSchema.optional(),
  merchantId:     mongoIdSchema.optional(),
  carrierId:      z.string().trim().optional(),
});

const velocityNdrReattemptSchema = z.object({
  awb: z.string().min(6).trim(),
  updated_address: z.object({
    address_line: z.string().trim().optional(),
    landmark: z.string().trim().optional(),
  }).optional(),
  updated_phone_number: z.string().trim().optional(),
  comments: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  if (data.updated_address && !data.updated_address.address_line && !data.updated_address.landmark) {
    ctx.addIssue({
      code: 'custom',
      path: ['updated_address'],
      message: 'updated_address must include address_line or landmark',
    });
  }
});

const velocityRtoSchema = z.object({
  awb: z.string().min(6).trim(),
});

const velocityOrderDetailsSchema = z.object({
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(100).optional(),
}).passthrough();

module.exports = {
  createShipmentSchema,
  updateShipmentSchema,
  updateStatusSchema,
  listShipmentsQuerySchema,
  shipmentStatsQuerySchema,
  awbSearchSchema,
  serviceabilitySchema,
  velocityRatesSchema,
  createReverseShipmentSchema,
  velocityNdrReattemptSchema,
  velocityRtoSchema,
  velocityOrderDetailsSchema,
};
