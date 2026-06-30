'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { sanitizeFilename } = require('../sanitizers/string.sanitizer');

const TYPE_RULES = Object.freeze({
  'image/png':  { extensions: ['.png'],            signatures: ['89504e470d0a1a0a'] },
  'image/jpeg': { extensions: ['.jpg', '.jpeg'],   signatures: ['ffd8ff'] },
  'application/pdf': { extensions: ['.pdf'],       signatures: ['25504446'] },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extensions: ['.docx'], signatures: ['504b0304'] },
  'text/csv':   { extensions: ['.csv'],            signatures: [] },
  // Excel formats (xlsx is a ZIP-based format, xls is legacy OLE2)
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    extensions: ['.xlsx'],
    signatures: ['504b0304'], // ZIP PK header
  },
  'application/vnd.ms-excel': {
    extensions: ['.xls'],
    signatures: ['d0cf11e0a1b11ae1'], // OLE2 compound document header
  },
});

function uploadError(message, code = 'INVALID_FILE') {
  return Object.assign(new Error('Validation failed'), {
    name: 'ValidationError', statusCode: 400,
    errors: [{ field: 'file', code, message }],
  });
}

function readBuffer(file) {
  if (file.buffer) return file.buffer;
  if (file.path) return fs.readFileSync(file.path);
  return Buffer.alloc(0);
}

function validateMagicBytes(file, allowedTypes) {
  const rule = TYPE_RULES[file.mimetype];
  if (!rule || !allowedTypes.includes(file.mimetype)) throw uploadError('File type is not allowed', 'FILE_TYPE_NOT_ALLOWED');
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (!rule.extensions.includes(extension)) throw uploadError('File extension does not match its content type', 'FILE_EXTENSION_MISMATCH');
  if (rule.signatures.length) {
    const prefix = readBuffer(file).subarray(0, 12).toString('hex');
    if (!rule.signatures.some((signature) => prefix.startsWith(signature))) {
      throw uploadError('File signature does not match its declared type', 'FILE_SIGNATURE_MISMATCH');
    }
  }
}

function detectMalware(file) {
  const content = readBuffer(file).toString('utf8', 0, 4096);
  if (content.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE') || /<script\b/i.test(content)) {
    throw uploadError('File failed security scanning', 'MALWARE_DETECTED');
  }
}

function validateCsv(file, options = {}) {
  const buffer = readBuffer(file);
  if (buffer.includes(0)) throw uploadError('CSV contains binary content', 'INVALID_CSV');
  let rows;
  try {
    rows = parse(buffer, { columns: true, skip_empty_lines: true, trim: true, to: options.maxPreviewRows || 100 });
  } catch {
    throw uploadError('CSV content is malformed', 'INVALID_CSV');
  }
  const requiredHeaders = options.requiredHeaders || [];
  const headers = rows[0] ? Object.keys(rows[0]).map((header) => header.toLowerCase()) : [];
  const missing = requiredHeaders.filter((header) => !headers.includes(header.toLowerCase()));
  if (missing.length) throw uploadError(`CSV is missing required columns: ${missing.join(', ')}`, 'CSV_HEADERS_MISSING');
}

/**
 * Validate Excel file headers using the xlsx library.
 * Only checks required headers from the first sheet.
 */
function validateXlsx(file, options = {}) {
  let xlsx;
  try {
    xlsx = require('xlsx');
  } catch {
    throw uploadError('Excel processing library not available', 'XLSX_LIBRARY_MISSING');
  }
  const buffer = readBuffer(file);
  let workbook;
  try {
    workbook = xlsx.read(buffer, { type: 'buffer' });
  } catch {
    throw uploadError('Excel file is malformed or corrupted', 'INVALID_XLSX');
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw uploadError('Excel file contains no sheets', 'INVALID_XLSX');
  const sheet = workbook.Sheets[sheetName];
  const rows  = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rows.length || !rows[0].length) throw uploadError('Excel file is empty', 'INVALID_XLSX');
  const requiredHeaders = options.requiredHeaders || [];
  if (requiredHeaders.length) {
    const headers = rows[0].map((h) => String(h).toLowerCase().trim());
    const missing = requiredHeaders.filter((h) => !headers.includes(h.toLowerCase()));
    if (missing.length) throw uploadError(`Excel is missing required columns: ${missing.join(', ')}`, 'XLSX_HEADERS_MISSING');
  }
}

function createUploadValidator(options = {}) {
  const {
    fieldName = 'file',
    allowedTypes = Object.keys(TYPE_RULES),
    maxSize = 5 * 1024 * 1024,
    maxFiles = 1,
    destination,
    csv,
    scanFile,
  } = options;

  const storage = destination
    ? multer.diskStorage({
      destination: (_req, _file, callback) => callback(null, destination),
      filename: (_req, file, callback) => callback(null, `${Date.now()}-${sanitizeFilename(file.originalname)}`),
    })
    : multer.memoryStorage();

  const parser = multer({
    storage,
    limits: { fileSize: maxSize, files: maxFiles },
    fileFilter: (_req, file, callback) => {
      const rule = TYPE_RULES[file.mimetype];
      const extension = path.extname(file.originalname || '').toLowerCase();
      callback(rule && allowedTypes.includes(file.mimetype) && rule.extensions.includes(extension)
        ? null : uploadError('File type is not allowed', 'FILE_TYPE_NOT_ALLOWED'), Boolean(rule));
    },
  });

  const multerMiddleware = maxFiles === 1 ? parser.single(fieldName) : parser.array(fieldName, maxFiles);
  const EXCEL_MIMES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];

  const securityMiddleware = async (req, _res, next) => {
    const files = req.files || (req.file ? [req.file] : []);
    try {
      if (!files.length && options.required !== false) throw uploadError('File is required', 'FILE_REQUIRED');
      for (const file of files) {
        validateMagicBytes(file, allowedTypes);
        detectMalware(file);
        if (csv && file.mimetype === 'text/csv') validateCsv(file, csv);
        if (csv && EXCEL_MIMES.includes(file.mimetype)) validateXlsx(file, csv);
        if (scanFile) {
          const scanResult = await scanFile(file);
          if (scanResult === false || scanResult?.safe === false) throw uploadError('File failed antivirus scanning', 'MALWARE_DETECTED');
        }
      }
      next();
    } catch (error) {
      for (const file of files) {
        if (file.path) fs.promises.unlink(file.path).catch(() => undefined);
      }
      next(error);
    }
  };
  return [multerMiddleware, securityMiddleware];
}

module.exports = {
  TYPE_RULES,
  createUploadValidator,
  validateMagicBytes,
  validateCsv,
  validateXlsx,
  detectMalware,
};
