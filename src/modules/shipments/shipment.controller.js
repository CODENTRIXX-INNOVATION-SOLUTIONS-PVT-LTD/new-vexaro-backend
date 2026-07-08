const crypto        = require('crypto');
const {
  listShipmentsService,
  createShipmentService,
  getShipmentByIdService,
  updateShipmentService,
  deleteShipmentService,
  updateStatusService,
  processBulkUploadAsync,
  awbSearchService,
  shipmentStatsService,
  checkServiceabilityService,
  getVelocityRatesService,
  reattemptVelocityDeliveryService,
  initiateVelocityRtoService,
  listVelocityForwardShipmentsService,
  listVelocityReturnShipmentsService,
  createReverseShipmentService,
} = require('./shipment.service');
const { BulkJob } = require('./bulk-job.model');
const { REQUIRED_CSV_COLS, REQUIRED_CSV_ONE_OF_COLS } = require('./shared/shipment.constants');
const { success, created, paginated } = require('../../utils');
const { wrapController } = require('../../utils/errors');
const { getPaginationParams, buildPaginationMeta } = require('../../utils/pagination');
const { parse } = require('csv-parse/sync');

// ─── Multer: memory storage for CSV upload ────────────────────────────────────
// Store file in memory (buffer) — no disk writes needed for CSV parsing.
const withErrorHandling = wrapController;

// ─── GET /api/shipments ────────────────────────────────────────────────────────
const listShipments = withErrorHandling(async (req, res) => {
  const query = req.validated.query;
  const { page, limit } = getPaginationParams(query, 20);
  const { items, total } = await listShipmentsService(query, req.user);
  const meta = buildPaginationMeta(total, page, limit);
  paginated(res, 'Shipments retrieved successfully', { shipments: items }, meta);
});

// ─── POST /api/shipments ───────────────────────────────────────────────────────
const createShipment = withErrorHandling(async (req, res) => {
  const dto = req.validated.body;
  const shipment = await createShipmentService(dto, req.user);
  created(res, 'Shipment created successfully', shipment);
});

// ─── GET /api/shipments/stats ─────────────────────────────────────────────────
const getShipmentStats = withErrorHandling(async (req, res) => {
  const stats = await shipmentStatsService(req.user, req.validated.query || {});
  success(res, 'Shipment stats retrieved', stats);
});

// ─── GET /api/shipments/track/:awb ────────────────────────────────────────────
const trackByAWB = withErrorHandling(async (req, res) => {
  const { awb } = req.validated.params;
  const shipment = await awbSearchService(awb, req.user);
  
  const statusHistory = (shipment.statusHistory || []).map(h => ({
    status: h.status,
    timestamp: h.timestamp,
    note: h.note,
  }));
  const fallbackTrackingUrl = shipment.trackingUrl
    || (shipment.carrierAWB ? `https://www.velocityshipping.in/track/${shipment.carrierAWB}` : null);

  const safeData = {
    awb: shipment.awb,
    carrier: shipment.carrier,
    carrierAWB: shipment.carrierAWB,
    velocityShipmentId: shipment.velocityShipmentId,
    velocityOrderId: shipment.velocityOrderId,
    merchantOrderRef: shipment.merchantOrderRef,
    trackingUrl: fallbackTrackingUrl,
    subStatus: shipment.subStatus,
    shipmentType: shipment.shipmentType,
    isReturn: shipment.isReturn,
    qcStatus: shipment.qcStatus,
    qcFailureReason: shipment.qcFailureReason,
    qcImages: shipment.qcImages,
    qcCheckedAt: shipment.qcCheckedAt,
    estimatedDelivery: shipment.estimatedDelivery,
    originalEstimatedDelivery: shipment.originalEstimatedDelivery,
    deliveredAt: shipment.deliveredAt,
    status: shipment.status,
    history: statusHistory,
    statusHistory,
    origin: {
      name: shipment.origin?.name,
      phone: shipment.origin?.phone,
      addressLine: shipment.origin?.addressLine,
      city: shipment.origin?.city,
      state: shipment.origin?.state,
      pincode: shipment.origin?.pincode,
      country: shipment.origin?.country,
    },
    destination: {
      name: shipment.destination?.name,
      phone: shipment.destination?.phone,
      email: shipment.destination?.email,
      addressLine: shipment.destination?.addressLine,
      city: shipment.destination?.city,
      state: shipment.destination?.state,
      pincode: shipment.destination?.pincode,
      country: shipment.destination?.country,
    },
    weight: shipment.weight,
    serviceType: shipment.serviceType,
    createdAt: shipment.createdAt,
    velocityTracking: shipment.velocityTracking,
  };

  success(res, 'Shipment found', safeData);
});

// ─── GET /api/shipments/:id ───────────────────────────────────────────────────
const getShipmentById = withErrorHandling(async (req, res) => {
  const shipment = await getShipmentByIdService(req.params.id, req.user);
  success(res, 'Shipment retrieved successfully', shipment);
});

// ─── PATCH /api/shipments/:id ─────────────────────────────────────────────────
const updateShipment = withErrorHandling(async (req, res) => {
  const dto = req.validated.body;
  const shipment = await updateShipmentService(req.params.id, dto, req.user);
  success(res, 'Shipment updated successfully', shipment);
});

// ─── DELETE /api/shipments/:id ────────────────────────────────────────────────
const deleteShipment = withErrorHandling(async (req, res) => {
  const result = await deleteShipmentService(req.params.id, req.user);
  success(res, result.message);
});

// ─── PATCH /api/shipments/:id/status ─────────────────────────────────────────
const updateStatus = withErrorHandling(async (req, res) => {
  const dto = req.validated.body;
  const shipment = await updateStatusService(req.params.id, dto, req.user);
  success(res, `Shipment status updated to ${shipment.status}`, shipment);
});

// ─── POST /api/shipments/bulk-upload ─────────────────────────────────────────
// Returns 202 immediately with a jobId.
// Processing runs in the background via setImmediate.
// Poll GET /api/shipments/bulk-status/:jobId for progress.
const EXCEL_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

const bulkUpload = withErrorHandling(async (req, res) => {
  if (!req.file) {
    throw Object.assign(new Error('File is required. Send as multipart/form-data with field name "file".'), { statusCode: 400 });
  }

  const mimetype = req.file.mimetype;
  const isExcel  = EXCEL_MIMES.has(mimetype);
  let totalRows  = 0;

  if (isExcel) {
    // Count rows from first sheet
    try {
      const xlsx = require('xlsx');
      const wb   = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows  = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    totalRows   = rows.length;
    if (!rows.length) {
      throw Object.assign(new Error('Excel file is empty.'), { statusCode: 400 });
    }
    const headers = Object.keys(rows[0]).map(h => h.toLowerCase().trim());
    const missingCols = REQUIRED_CSV_COLS.filter(col => !headers.includes(col));
    if (missingCols.length) {
      throw Object.assign(
        new Error(`Excel missing required columns: ${missingCols.join(', ')}`),
        { statusCode: 400 },
      );
    }
    const missingAny = REQUIRED_CSV_ONE_OF_COLS.filter(group => !group.some(col => headers.includes(col)));
    if (missingAny.length) {
      throw Object.assign(
        new Error(`Excel missing one of required columns: ${missingAny.map(group => group.join(' or ')).join(', ')}`),
        { statusCode: 400 },
      );
    }
    } catch (xlsxErr) {
      throw Object.assign(new Error(`Excel parse error: ${xlsxErr.message}`), { statusCode: 400 });
    }
  } else {
    // CSV: validate headers using first rows only
    let rows;
    try {
      rows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true, to: 2 });
    } catch (parseErr) {
      throw Object.assign(new Error(`CSV parse error: ${parseErr.message}`), { statusCode: 400 });
    }

    if (!rows.length) {
      throw Object.assign(new Error('CSV file is empty.'), { statusCode: 400 });
    }

    const headers    = Object.keys(rows[0]).map(h => h.toLowerCase().trim());
    const missingCols = REQUIRED_CSV_COLS.filter(col => !headers.includes(col));
    if (missingCols.length) {
      throw Object.assign(
        new Error(`CSV missing required columns: ${missingCols.join(', ')}`),
        { statusCode: 400 },
      );
    }
    const missingAny = REQUIRED_CSV_ONE_OF_COLS.filter(group => !group.some(col => headers.includes(col)));
    if (missingAny.length) {
      throw Object.assign(
        new Error(`CSV missing one of required columns: ${missingAny.map(group => group.join(' or ')).join(', ')}`),
        { statusCode: 400 },
      );
    }

    // Count all rows
    let allRows;
    try {
      allRows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
    } catch {
      allRows = rows;
    }
    totalRows = allRows.length;
  }

  // Create the job record
  const jobId = `BULK-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  await BulkJob.create({
    jobId,
    userId:    req.user.userId,
    status:    'QUEUED',
    totalRows,
  });

  // Store caller context to pass into async processor
  const caller     = req.user;
  const fileBuffer = req.file.buffer;
  const fileMime   = mimetype;

  // Fire-and-forget — processing starts after response is sent
  setImmediate(() => processBulkUploadAsync(jobId, fileBuffer, caller, fileMime).catch(() => {}));

  return res.status(202).json({
    success: true,
    message: `Bulk upload queued. ${totalRows} rows will be processed in the background.`,
    data: {
      jobId,
      status: 'QUEUED',
      estimatedCompletion: new Date(Date.now() + totalRows * 200).toISOString(),
    },
    requestId: req.requestId || null,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/shipments/bulk-status/:jobId ────────────────────────────────────
const getBulkUploadStatus = withErrorHandling(async (req, res) => {
  const job = await BulkJob.findOne({
    jobId:  req.params.jobId,
    userId: req.user.userId,
  });

  if (!job) {
    throw Object.assign(new Error('Bulk upload job not found'), { statusCode: 404 });
  }

  const errorPage = Math.max(1, parseInt(req.query.errorPage || req.query.page || '1', 10) || 1);
  const errorLimit = Math.min(100, Math.max(1, parseInt(req.query.errorLimit || req.query.limit || '50', 10) || 50));
  const errorOffset = (errorPage - 1) * errorLimit;
  const rowErrors = job.rowErrors || [];
  const pagedErrors = rowErrors.slice(errorOffset, errorOffset + errorLimit);

  success(res, 'Bulk upload status retrieved', {
    jobId:       job.jobId,
    status:      job.status,
    totalRows:   job.totalRows,
    createdRows: job.createdRows,
    failedRows:  job.failedRows,
    errors:      pagedErrors,
    errorMeta: {
      total: rowErrors.length,
      page: errorPage,
      limit: errorLimit,
      pages: Math.ceil(rowErrors.length / errorLimit) || 1,
      hasNextPage: errorOffset + errorLimit < rowErrors.length,
      hasPrevPage: errorPage > 1,
    },
    fatalError:  job.fatalError,
    createdAt:   job.createdAt,
  });
});

// ─── POST /api/shipments/serviceability ──────────────────────────────────────
const checkServiceability = withErrorHandling(async (req, res) => {
  const dto = req.validated.body;
  const result = await checkServiceabilityService(dto);
  success(res, 'Serviceability checked successfully', result);
});

// ─── POST /api/shipments/velocity-rates ───────────────────────────────────────
const getVelocityRates = withErrorHandling(async (req, res) => {
  const dto = req.validated.body;
  const result = await getVelocityRatesService(dto, req.user);
  success(res, 'Velocity rates retrieved successfully', result);
});

const reattemptVelocityDelivery = withErrorHandling(async (req, res) => {
  const result = await reattemptVelocityDeliveryService(req.validated.body, req.user);
  success(res, 'Velocity reattempt requested successfully', result);
});

const initiateVelocityRto = withErrorHandling(async (req, res) => {
  const result = await initiateVelocityRtoService(req.validated.body, req.user);
  success(res, 'Velocity RTO requested successfully', result);
});

const listVelocityForwardShipments = withErrorHandling(async (req, res) => {
  const result = await listVelocityForwardShipmentsService(req.validated.body);
  success(res, 'Velocity forward shipments retrieved successfully', result);
});

const listVelocityReturnShipments = withErrorHandling(async (req, res) => {
  const result = await listVelocityReturnShipmentsService(req.validated.body);
  success(res, 'Velocity return shipments retrieved successfully', result);
});

// ─── POST /api/shipments/reverse ─────────────────────────────────────────────
const createReverseShipment = withErrorHandling(async (req, res) => {
  const dto = req.validated.body;
  const shipment = await createReverseShipmentService(dto, req.user);
  created(res, 'Reverse shipment created successfully', shipment);
});

module.exports = {
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
};
