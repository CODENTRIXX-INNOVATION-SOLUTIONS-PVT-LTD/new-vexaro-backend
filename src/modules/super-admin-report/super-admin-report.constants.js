'use strict';

/**
 * Super Admin Report Constants
 * Placeholder enums and constants for future use
 * 
 * TODO: Expand constants as needed during implementation
 */

// Report Types
const ReportType = Object.freeze({
  DASHBOARD: 'DASHBOARD',
  SHIPMENT: 'SHIPMENT',
  REVENUE: 'REVENUE',
  COD: 'COD',
  MERCHANT: 'MERCHANT',
  DISTRIBUTOR: 'DISTRIBUTOR',
  COURIER: 'COURIER',
  USER: 'USER',
  PERFORMANCE: 'PERFORMANCE',
});

// Date Filter Periods
const DatePeriod = Object.freeze({
  TODAY: 'today',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
  CUSTOM: 'custom',
});

// Export Formats
const ExportFormat = Object.freeze({
  CSV: 'csv',
  XLSX: 'xlsx',
  PDF: 'pdf',
});

// Export Status
const ExportStatus = Object.freeze({
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
});

// Aggregation Types
const AggregationType = Object.freeze({
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
});

// Default Pagination
const DefaultPagination = Object.freeze({
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
});

module.exports = {
  ReportType,
  DatePeriod,
  ExportFormat,
  ExportStatus,
  AggregationType,
  DefaultPagination,
};
