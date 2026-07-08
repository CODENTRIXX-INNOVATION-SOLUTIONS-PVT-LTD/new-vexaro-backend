'use strict';

const { parse } = require('csv-parse/sync');
const { BulkJob } = require('../bulk-job.model');
const { UserRole } = require('../../../constants');
const { REQUIRED_CSV_COLS } = require('../shared/shipment.constants');
const userRepository = require('../../users/user.repository');
const { createShipmentService } = require('./shipment-create.service');
const logger = require('../../../utils/logger');

const EXCEL_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

/**
 * Parse file buffer into normalised row objects.
 * Supports CSV (text/csv) and Excel (.xlsx / .xls).
 * Returns an array of plain objects with lowercase-trimmed keys.
 *
 * @param {Buffer}  fileBuffer  — raw file bytes
 * @param {string}  mimetype    — MIME type declared by multer
 * @returns {{ rows: object[], isCsv: boolean }}
 */
const parseFileBuffer = (fileBuffer, mimetype) => {
  if (EXCEL_MIMES.has(mimetype)) {
    let xlsx;
    try {
      xlsx = require('xlsx');
    } catch {
      const err = new Error('Excel processing library (xlsx) is not installed.');
      err.statusCode = 500;
      throw err;
    }
    let workbook;
    try {
      workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    } catch (xlsxErr) {
      const err = new Error(`Excel parse error: ${xlsxErr.message}`);
      err.statusCode = 400;
      throw err;
    }
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      const err = new Error('Excel file contains no sheets.');
      err.statusCode = 400;
      throw err;
    }
    const sheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    if (!rawRows.length) {
      const err = new Error('Excel file is empty.');
      err.statusCode = 400;
      throw err;
    }
    // Normalise keys to lowercase-trimmed
    const rows = rawRows.map((row) => {
      const normalised = {};
      for (const key of Object.keys(row)) {
        normalised[key.toLowerCase().trim()] = String(row[key] ?? '').trim();
      }
      return normalised;
    });
    return { rows, isCsv: false };
  }

  // Default: CSV
  let rows;
  try {
    rows = parse(fileBuffer, { columns: true, skip_empty_lines: true, trim: true });
  } catch (parseErr) {
    const err = new Error(`CSV parse error: ${parseErr.message}`);
    err.statusCode = 400;
    throw err;
  }
  // Normalise keys
  rows = rows.map((row) => {
    const normalised = {};
    for (const key of Object.keys(row)) {
      normalised[key.toLowerCase().trim()] = row[key];
    }
    return normalised;
  });
  return { rows, isCsv: true };
};

const validateRequiredHeaders = (rows) => {
  const headers = Object.keys(rows[0] || {});
  const missingCols = REQUIRED_CSV_COLS.filter((col) => !headers.includes(col));
  if (missingCols.length) {
    const err = new Error(`File missing required columns: ${missingCols.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
};

const parsePositiveNumber = (row, field, rowNum) => {
  const value = Number(row[field]);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Row ${rowNum}: ${field} must be a positive number.`);
  }
  return value;
};

const parseNonNegativeNumber = (row, field, rowNum) => {
  const value = Number(row[field]);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Row ${rowNum}: ${field} must be zero or a positive number.`);
  }
  return value;
};

const parsePositiveInteger = (row, field, rowNum) => {
  const value = Number.parseInt(row[field], 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Row ${rowNum}: ${field} must be a positive whole number.`);
  }
  return value;
};

const normalizePaymentMethod = (row, rowNum) => {
  const paymentMethod = String(row.payment_method || '').trim().toUpperCase();
  if (!['COD', 'PREPAID'].includes(paymentMethod)) {
    throw new Error(`Row ${rowNum}: payment_method must be COD or PREPAID.`);
  }
  return paymentMethod;
};

const resolveMerchantAndDistributor = async (row, caller, baseMerchantId, rowNum) => {
  let rowMerchantId = baseMerchantId;
  if (!rowMerchantId) {
    if (!row.merchant_email && !row.merchant_id) {
      throw new Error(`Row ${rowNum}: merchant_email or merchant_id is required for non-merchant callers.`);
    }
    if (row.merchant_id) {
      rowMerchantId = row.merchant_id;
    } else {
      const merchant = await userRepository.findOne({
        email:     row.merchant_email.toLowerCase(),
        role:      UserRole.MERCHANT,
        deletedAt: null,
      });
      if (!merchant) throw new Error(`Row ${rowNum}: Merchant with email "${row.merchant_email}" not found.`);
      rowMerchantId = merchant._id.toString();
    }
  }

  let distributorId = null;
  if (caller.role === UserRole.DISTRIBUTOR) {
    distributorId = caller.userId;
  } else {
    const merchant = await userRepository.findOne({ _id: rowMerchantId });
    if (merchant?.invitedBy) distributorId = merchant.invitedBy.toString();
  }

  return { rowMerchantId, distributorId };
};

const buildShipmentDtoFromRow = async (row, caller, baseMerchantId, rowNum) => {
  const weight = parsePositiveNumber(row, 'weight', rowNum);
  const length = parsePositiveNumber(row, 'length', rowNum);
  const breadth = parsePositiveNumber(row, 'breadth', rowNum);
  const height = parsePositiveNumber(row, 'height', rowNum);
  const declaredValue = parsePositiveNumber(row, 'declared_value', rowNum);
  const quantity = parsePositiveInteger(row, 'quantity', rowNum);
  const sellingPrice = parsePositiveNumber(row, 'selling_price', rowNum);
  const discount = parseNonNegativeNumber(row, 'discount', rowNum);
  const tax = parseNonNegativeNumber(row, 'tax', rowNum);
  const paymentMethod = normalizePaymentMethod(row, rowNum);
  const codAmount = parseNonNegativeNumber(row, 'cod_amount', rowNum);

  if (paymentMethod === 'COD' && codAmount <= 0) {
    throw new Error(`Row ${rowNum}: cod_amount must be greater than zero for COD shipments.`);
  }
  if (paymentMethod === 'PREPAID' && codAmount !== 0) {
    throw new Error(`Row ${rowNum}: cod_amount must be 0 for PREPAID shipments.`);
  }
  if (paymentMethod === 'COD' && codAmount > declaredValue) {
    throw new Error(`Row ${rowNum}: cod_amount cannot exceed declared_value.`);
  }

  const { rowMerchantId, distributorId } = await resolveMerchantAndDistributor(row, caller, baseMerchantId, rowNum);

  return {
    merchantId: rowMerchantId,
    distributorId,
    origin: {
      name:        row.origin_name,
      phone:       row.origin_phone,
      addressLine: row.origin_address,
      city:        row.origin_city,
      state:       row.origin_state,
      pincode:     row.origin_pincode,
      country:     row.origin_country || 'India',
    },
    destination: {
      name:        row.dest_name,
      phone:       row.dest_phone,
      ...(row.dest_email ? { email: row.dest_email } : {}),
      addressLine: row.dest_address,
      city:        row.dest_city,
      state:       row.dest_state,
      pincode:     row.dest_pincode,
      country:     row.dest_country || 'India',
    },
    weight,
    length,
    breadth,
    height,
    declaredValue,
    isCOD: paymentMethod === 'COD',
    paymentMethod,
    codAmount,
    productName: row.product_name,
    sku: row.sku,
    quantity,
    sellingPrice,
    discount,
    tax,
    serviceType: (['STANDARD', 'EXPRESS', 'SAME_DAY'].includes(String(row.service_type ?? '').toUpperCase()))
      ? String(row.service_type).toUpperCase()
      : 'STANDARD',
    merchantOrderRef: row.order_ref || null,
    invoiceNumber: row.invoice_number || null,
    notes: row.notes || null,
    warehouseId: /^[a-f\d]{24}$/i.test(row.warehouse_id || '') ? row.warehouse_id : undefined,
    carrierId: row.carrier_id || undefined,
  };
};

const bulkUploadService = async (fileBuffer, caller, mimetype = 'text/csv') => {
  let rows;
  try {
    ({ rows } = parseFileBuffer(fileBuffer, mimetype));
  } catch (err) {
    throw err; // already has statusCode
  }

  if (!rows.length) {
    const err = new Error('File is empty.');
    err.statusCode = 400;
    throw err;
  }

  validateRequiredHeaders(rows);

  const merchantId = caller.role === UserRole.MERCHANT ? caller.userId : null;
  const results = { created: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const dto = await buildShipmentDtoFromRow(row, caller, merchantId, rowNum);
      await createShipmentService(dto, caller);

      results.created++;
    } catch (rowErr) {
      results.failed++;
      results.errors.push(rowErr.message || `Row ${rowNum}: unknown error`);
    }
  }

  return results;
};

const processBulkUploadAsync = async (jobId, fileBuffer, caller, mimetype = 'text/csv') => {
  try {
    await BulkJob.findOneAndUpdate({ jobId }, { status: 'PROCESSING' });

    let rows;
    try {
      ({ rows } = parseFileBuffer(fileBuffer, mimetype));
    } catch (parseErr) {
      await BulkJob.findOneAndUpdate({ jobId }, {
        status:     'FAILED',
        fatalError: parseErr.message,
      });
      logger.error('bulk_upload_parse_failed', { jobId, error: parseErr.message });
      return;
    }

    const baseMerchantId = caller.role === UserRole.MERCHANT ? caller.userId : null;
    try {
      validateRequiredHeaders(rows);
    } catch (headerErr) {
      await BulkJob.findOneAndUpdate({ jobId }, {
        status:     'FAILED',
        fatalError: headerErr.message,
      });
      logger.error('bulk_upload_header_validation_failed', { jobId, error: headerErr.message });
      return;
    }

    let created = 0;
    let failed  = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row    = rows[i];
      const rowNum = i + 2;

      try {
        const dto = await buildShipmentDtoFromRow(row, caller, baseMerchantId, rowNum);
        await createShipmentService(dto, caller);

        created++;

        await BulkJob.findOneAndUpdate({ jobId }, {
          createdRows: created,
          failedRows:  failed,
          rowErrors: errors,
        });

      } catch (rowErr) {
        failed++;
        const errMsg = rowErr.message || `Row ${rowNum}: unknown error`;
        if (errors.length < 200) errors.push(errMsg);

        await BulkJob.findOneAndUpdate({ jobId }, {
          createdRows: created,
          failedRows:  failed,
          rowErrors: errors,
        });
      }
    }

    const finalStatus = failed === rows.length && rows.length > 0 ? 'FAILED' : 'COMPLETED';
    await BulkJob.findOneAndUpdate({ jobId }, {
      status:      finalStatus,
      createdRows: created,
      failedRows:  failed,
      rowErrors: errors,
    });

    logger.info('bulk_upload_completed', {
      jobId,
      created,
      failed,
      total:  rows.length,
      status: finalStatus,
      userId: caller.userId,
    });

  } catch (fatalErr) {
    logger.error('bulk_upload_fatal_error', { jobId, error: fatalErr.message });
    try {
      await BulkJob.findOneAndUpdate({ jobId }, {
        status:     'FAILED',
        fatalError: fatalErr.message,
      });
    } catch {
      // Ignore secondary error — job status update failure should not crash
    }
  }
};

module.exports = {
  bulkUploadService,
  processBulkUploadAsync,
  parseFileBuffer, // exported for unit testing
};
