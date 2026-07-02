'use strict';

const mongoose = require('mongoose');

const ExportJobStatus = Object.freeze({
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
});

const ExportJobType = Object.freeze({
  SHIPMENTS: 'SHIPMENTS',
  REVENUE: 'REVENUE',
});

const ExportJobFormat = Object.freeze({
  CSV: 'CSV',
  XLSX: 'XLSX',
  PDF: 'PDF',
});

const exportJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(ExportJobType),
      required: true,
    },
    format: {
      type: String,
      enum: Object.values(ExportJobFormat),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ExportJobStatus),
      default: ExportJobStatus.PENDING,
      index: true,
    },
    filter: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    fileUrl: {
      type: String,
      default: null,
    },
    filePath: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

exportJobSchema.index({ userId: 1, createdAt: -1 });

const ExportJob = mongoose.model('ExportJob', exportJobSchema);

module.exports = {
  ExportJob,
  ExportJobStatus,
  ExportJobType,
  ExportJobFormat,
};
