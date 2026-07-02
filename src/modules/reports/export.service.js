'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { ExportJob, ExportJobStatus, ExportJobType, ExportJobFormat } = require('./export-job.model');
const reportRepository = require('./report.repository');
const { UserRole } = require('../../constants');
const { sendExportReadyEmail } = require('../../utils/email');
const logger = require('../../utils/logger');

const EXPORTS_DIR = path.join(process.cwd(), 'exports');

// Helper to throw errors
const throwError = (message, code = 400) =>
  Object.assign(new Error(message), { statusCode: code });

/**
 * Builds the database query filter matching the controller's implementation
 */
const buildScopeFilter = (caller, query = {}) => {
  const f = { deletedAt: null };
  if (caller.role === UserRole.MERCHANT)     f.merchantId    = caller.userId;
  else if (caller.role === UserRole.DISTRIBUTOR) f.distributorId = caller.userId;
  else if (caller.role === UserRole.WAREHOUSE)   f.warehouseId   = caller.userId;

  if (caller.role === UserRole.SUPER_ADMIN) {
    if (query.merchantId)    f.merchantId    = query.merchantId;
    if (query.distributorId) f.distributorId = query.distributorId;
    if (query.warehouseId)   f.warehouseId   = query.warehouseId;
  }

  const now = new Date();
  let dateFrom = query.dateFrom ? new Date(query.dateFrom) : null;
  let dateTo = query.dateTo ? new Date(query.dateTo) : null;

  // Default: last 90 days
  if (!dateFrom && !dateTo) {
    dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 90);
    dateTo = now;
  } else if (!dateTo) {
    dateTo = now;
  } else if (!dateFrom) {
    dateFrom = new Date(dateTo);
    dateFrom.setDate(dateFrom.getDate() - 90);
  }

  // Max 1 year range limit
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  if (dateFrom < oneYearAgo) {
    throw throwError('Export date range cannot exceed 1 year', 400);
  }

  f.createdAt = {
    $gte: dateFrom,
    $lte: dateTo,
  };

  return { filter: f, dateFrom, dateTo };
};

/**
 * Create a new async export job
 */
const createExportJobService = async (dto, caller) => {
  const { type, format, ...query } = dto;

  if (!Object.values(ExportJobType).includes(type)) {
    throw throwError('Invalid export type.', 400);
  }
  if (!Object.values(ExportJobFormat).includes(format)) {
    throw throwError('Invalid export format.', 400);
  }

  // Verify and build query filters
  const { filter, dateFrom, dateTo } = buildScopeFilter(caller, query);

  const jobId = `EXP-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  
  const job = await ExportJob.create({
    jobId,
    userId: caller.userId,
    type,
    format,
    status: ExportJobStatus.PENDING,
    filter: {
      mongoQuery: filter,
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
    },
  });

  // Start background job worker processing
  setImmediate(() => processExportJobAsync(jobId, caller).catch((err) => {
    logger.error('export_job_background_failed', { jobId, error: err.message });
  }));

  return job;
};

/**
 * Poll job status
 */
const getExportJobStatusService = async (jobId, caller) => {
  const job = await ExportJob.findOne({ jobId });
  if (!job) {
    throw throwError('Export job not found.', 404);
  }

  // Ensure security: owner check (SA bypasses)
  if (caller.role !== UserRole.SUPER_ADMIN && String(job.userId) !== String(caller.userId)) {
    throw throwError('Access denied.', 403);
  }

  return job;
};

/**
 * Generates file buffer using cursor to stream data
 */
const generateFileBuffer = async (job, filter) => {
  const format = job.format;
  const isShipments = job.type === ExportJobType.SHIPMENTS;

  const data = [];
  if (isShipments) {
    const cursor = reportRepository.shipmentCursor(filter);
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      data.push({
        AWB: doc.awb || '',
        Status: doc.status || '',
        MerchantID: String(doc.merchantId || ''),
        DistributorID: String(doc.distributorId || ''),
        WarehouseID: String(doc.warehouseId || ''),
        Weight: doc.weight || 0,
        DeclaredValue: doc.declaredValue || 0,
        isCOD: doc.isCOD ? 'true' : 'false',
        CODAmount: doc.codAmount || 0,
        OriginCity: doc.origin?.city || '',
        DestinationCity: doc.destination?.city || '',
        CreatedAt: doc.createdAt ? doc.createdAt.toISOString() : '',
      });
    }
  } else {
    // REVENUE/TRANSACTIONS
    const cursor = reportRepository.transactionCursor(filter);
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      data.push({
        TransactionID: String(doc._id || ''),
        WalletID: String(doc.walletId || ''),
        UserID: String(doc.userId || ''),
        Type: doc.type || '',
        Amount: doc.amount || 0,
        BalanceBefore: doc.balanceBefore || 0,
        BalanceAfter: doc.balanceAfter || 0,
        Reference: doc.reference || '',
        PerformedBy: String(doc.performedBy || ''),
        CreatedAt: doc.createdAt ? doc.createdAt.toISOString() : '',
      });
    }
  }

  // CSV format
  if (format === ExportJobFormat.CSV) {
    if (data.length === 0) {
      return Buffer.from('');
    }
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    for (const item of data) {
      const values = headers.map((header) => {
        const val = String(item[header] ?? '');
        return `"${val.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }
    return Buffer.from(csvRows.join('\n'));
  }

  // Excel format
  if (format === ExportJobFormat.XLSX) {
    const xlsx = require('xlsx');
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, job.type);
    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // PDF format
  if (format === ExportJobFormat.PDF) {
    const PDFDocument = require('pdfkit');
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);

      // Title/Header details
      doc.fontSize(16).fillColor('#1a1a2e').text(`Vexaro ${job.type} Export Report`, { align: 'center' });
      doc.fontSize(10).fillColor('#666666').text(`Job ID: ${job.jobId} | Date: ${new Date().toISOString()}`, { align: 'center' });
      doc.moveDown();

      if (data.length === 0) {
        doc.fontSize(12).text('No records found for the specified filters.', { align: 'center' });
        doc.end();
        return;
      }

      // Minimal list presentation to fit in PDFkit
      doc.fontSize(9).fillColor('#333333');
      let rowNum = 1;
      for (const item of data) {
        // Draw key/value pairs
        doc.fontSize(10).fillColor('#111111').text(`Record #${rowNum++}`, { underline: true });
        doc.fontSize(9).fillColor('#333333');
        
        for (const [key, val] of Object.entries(item)) {
          doc.text(`  • ${key}: ${val}`);
        }
        doc.moveDown(0.5);

        // Simple page breaking safety
        if (doc.y > 700) {
          doc.addPage();
        }
      }

      doc.end();
    });
  }

  throw throwError(`Unsupported format: ${format}`, 400);
};

/**
 * Worker runner
 */
const processExportJobAsync = async (jobId, caller) => {
  const job = await ExportJob.findOne({ jobId });
  if (!job) return;

  try {
    await ExportJob.updateOne({ jobId }, { status: ExportJobStatus.PROCESSING });

    // Ensure exports directory exists
    if (!fs.existsSync(EXPORTS_DIR)) {
      fs.mkdirSync(EXPORTS_DIR, { recursive: true });
    }

    const ext = job.format.toLowerCase();
    const filename = `${job.jobId}.${ext}`;
    const filePath = path.join(EXPORTS_DIR, filename);

    // Retrieve scoped filter from filters
    const filter = job.filter.mongoQuery;

    // Generate output format buffer
    const buffer = await generateFileBuffer(job, filter);

    // Save to disk
    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/api/reports/export/download/${filename}`;

    await ExportJob.updateOne(
      { jobId },
      {
        status: ExportJobStatus.COMPLETED,
        fileUrl,
        filePath,
        completedAt: new Date(),
      }
    );

    // Send email alert to user
    try {
      await sendExportReadyEmail({
        to: caller.email,
        firstName: caller.firstName || caller.email,
        format: job.format,
        exportType: job.type,
        jobId,
      });
    } catch (emailErr) {
      logger.warn('export_job_email_notification_failed', { jobId, error: emailErr.message });
    }

  } catch (err) {
    logger.error('export_job_fatal_error', { jobId, error: err.message });
    await ExportJob.updateOne(
      { jobId },
      {
        status: ExportJobStatus.FAILED,
        errorMessage: err.message,
      }
    );
  }
};

module.exports = {
  createExportJobService,
  getExportJobStatusService,
  processExportJobAsync,
};
