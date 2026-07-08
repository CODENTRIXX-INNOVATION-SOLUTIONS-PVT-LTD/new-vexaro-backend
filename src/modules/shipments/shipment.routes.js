const { Router }         = require('express');
const { authMiddleware, requireRole } = require('../../middleware/auth.middleware');
const {
  listShipments,
  createShipment,
  getShipmentStats,
  trackByAWB,
  getShipmentById,
  updateShipment,
  deleteShipment,
  updateStatus,
  bulkUpload,
  getBulkUploadStatus,
  checkServiceability,
  getVelocityRates,
  reattemptVelocityDelivery,
  initiateVelocityRto,
  listVelocityForwardShipments,
  listVelocityReturnShipments,
  createReverseShipment,
} = require('./shipment.controller');
const { UserRole } = require('../../constants');
const { validateRequest } = require('../../validation');
const schemas = require('../../validation/schemas/shipments');
const { createUploadValidator } = require('../../validation/middleware/upload.middleware');
const { REQUIRED_CSV_COLS, REQUIRED_CSV_ONE_OF_COLS } = require('./shared/shipment.constants');

const bulkCsvUpload = createUploadValidator({
  allowedTypes: [
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ],
  maxSize: 10 * 1024 * 1024, // 10 MB
  required: true,
  csv: { requiredHeaders: REQUIRED_CSV_COLS, requiredAnyHeaders: REQUIRED_CSV_ONE_OF_COLS },
});

const router = Router();

// Every shipment route requires a valid JWT
router.use(authMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
//  STATIC / NAMED ROUTES  (must be declared BEFORE /:id to avoid collisions)
// ─────────────────────────────────────────────────────────────────────────────

// GET  /api/shipments/stats         — dashboard counts by status
router.get('/stats', validateRequest({ query: schemas.shipmentStatsQuerySchema }), getShipmentStats);

// GET  /api/shipments/track/:awb    — AWB search / public tracking
router.get('/track/:awb', validateRequest({ params: schemas.awbParamsSchema }), trackByAWB);

// POST /api/shipments/bulk-upload   — CSV bulk create (async, returns 202 immediately)
router.post(
  '/bulk-upload',
  requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR, UserRole.MERCHANT),
  ...bulkCsvUpload,
  bulkUpload,
);

// GET  /api/shipments/bulk-status/:jobId — poll async bulk upload progress
router.get('/bulk-status/:jobId', validateRequest({ params: schemas.bulkJobParamsSchema }), getBulkUploadStatus);
// POST /api/shipments/serviceability — live Velocity route check
router.post('/serviceability', validateRequest({ body: schemas.serviceabilitySchema }), checkServiceability);

// POST /api/shipments/velocity-rates — live Velocity rate quote
router.post('/velocity-rates', validateRequest({ body: schemas.velocityRatesSchema }), getVelocityRates);

router.post(
  '/velocity/ndr/reattempt',
  requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR, UserRole.MERCHANT),
  validateRequest({ body: schemas.velocityNdrReattemptSchema }),
  reattemptVelocityDelivery,
);

router.post(
  '/velocity/ndr/rto',
  requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR, UserRole.MERCHANT),
  validateRequest({ body: schemas.velocityRtoSchema }),
  initiateVelocityRto,
);

router.post(
  '/velocity/orders/forward',
  requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR),
  validateRequest({ body: schemas.velocityOrderDetailsSchema }),
  listVelocityForwardShipments,
);

router.post(
  '/velocity/orders/returns',
  requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR),
  validateRequest({ body: schemas.velocityOrderDetailsSchema }),
  listVelocityReturnShipments,
);

// POST /api/shipments/reverse — create Velocity return shipment
router.post(
  '/reverse',
  requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR, UserRole.MERCHANT),
  validateRequest({ body: schemas.createReverseShipmentSchema }),
  createReverseShipment,
);
// ─────────────────────────────────────────────────────────────────────────────
//  COLLECTION ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET  /api/shipments                — paginated list (scoped by role)
router.get('/', validateRequest({ query: schemas.listShipmentsQuerySchema }), listShipments);

// POST /api/shipments                — create a new shipment
//   WAREHOUSE users don't create shipments
router.post(
  '/',
  requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR, UserRole.MERCHANT),
  validateRequest({ body: schemas.createShipmentSchema }),
  createShipment,
);

// ─────────────────────────────────────────────────────────────────────────────
//  ITEM ROUTES  /:id
// ─────────────────────────────────────────────────────────────────────────────

// GET    /api/shipments/:id          — get single shipment
router.get('/:id', validateRequest({ params: schemas.shipmentIdParamsSchema }), getShipmentById);

// PATCH  /api/shipments/:id          — update non-status fields
router.patch(
  '/:id',
  requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR, UserRole.MERCHANT),
  validateRequest({ params: schemas.shipmentIdParamsSchema, body: schemas.updateShipmentSchema }),
  updateShipment,
);

// DELETE /api/shipments/:id          — soft delete (CREATED only)
router.delete(
  '/:id',
  requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR, UserRole.MERCHANT),
  validateRequest({ params: schemas.shipmentIdParamsSchema }),
  deleteShipment,
);

// PATCH  /api/shipments/:id/status   — status transition
router.patch('/:id/status', validateRequest({ params: schemas.shipmentIdParamsSchema, body: schemas.updateStatusSchema }), updateStatus);

module.exports = router;
