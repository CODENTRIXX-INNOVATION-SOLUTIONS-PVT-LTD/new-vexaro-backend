/**
 * src/modules/shipments/bulk-job.model.js
 *
 * Tracks the progress of async bulk CSV shipment upload jobs.
 *
 * Flow:
 *   1. POST /api/shipments/bulk-upload
 *      → Creates BulkJob { status: QUEUED }
 *      → Returns 202 with jobId immediately
 *      → Processing starts in background via setImmediate
 *
 *   2. Background processor
 *      → Sets status: PROCESSING
 *      → Increments createdRows / failedRows per row
 *      → Sets status: COMPLETED or FAILED when done
 *
 *   3. GET /api/shipments/bulk-status/:jobId
 *      → Returns current job state
 */

'use strict';

const mongoose = require('mongoose');

const bulkJobSchema = new mongoose.Schema(
  {
    // Unique job identifier returned to the caller immediately
    jobId: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },
    // The user who submitted the upload
    userId: {
      type:  mongoose.Schema.Types.ObjectId,
      ref:   'User',
      required: true,
      index: true,
    },
    // Current processing state
    status: {
      type:    String,
      enum:    ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'QUEUED',
      index:   true,
    },
    // Total rows found in the CSV (set at upload time, before processing)
    totalRows: {
      type:    Number,
      default: 0,
    },
    // Rows successfully created
    createdRows: {
      type:    Number,
      default: 0,
    },
    // Rows that failed
    failedRows: {
      type:    Number,
      default: 0,
    },
    // Per-row error messages (trimmed to max 200 entries to cap document size)
    // Named rowErrors to avoid collision with Mongoose's reserved 'errors' path
    rowErrors: {
      type:    [String],
      default: [],
    },
    // Optional error message if the entire job fails (e.g. CSV parse error)
    fatalError: {
      type:    String,
      default: null,
    },
  },
  { timestamps: true },
);

const BulkJob = mongoose.model('BulkJob', bulkJobSchema);

module.exports = { BulkJob };
