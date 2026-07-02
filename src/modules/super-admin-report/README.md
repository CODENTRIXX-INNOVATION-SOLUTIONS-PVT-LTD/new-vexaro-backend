# Super Admin Report Module

## Overview

This module provides reporting endpoints specifically for Super Admin users. It offers comprehensive analytics and insights across the entire platform, including shipments, revenue, merchants, distributors, and user activities.

## Purpose

To deliver centralized reporting capabilities for Super Admins to monitor platform performance, financial metrics, and operational statistics at a global level.

## Future Endpoints

The following endpoints will be implemented in this module:

### Dashboard Overview
- `GET /api/super-admin-report/overview` - Platform-wide summary statistics

### Shipment Reports
- `GET /api/super-admin-report/shipments/trend` - Shipment volume trends
- `GET /api/super-admin-report/shipments/status` - Status breakdown
- `GET /api/super-admin-report/shipments/summary` - Shipment summary
- `GET /api/super-admin-report/shipments/top-merchants` - Top merchants by shipments
- `GET /api/super-admin-report/shipments/recent` - Recent shipments
- `GET /api/super-admin-report/shipments/analytics` - Shipment analytics

### Revenue Reports
- `GET /api/super-admin-report/revenue/trend` - Revenue trends
- `GET /api/super-admin-report/revenue/source` - Revenue sources
- `GET /api/super-admin-report/revenue/insights` - Revenue insights
- `GET /api/super-admin-report/revenue/top-merchants` - Top revenue merchants
- `GET /api/super-admin-report/revenue/payment-methods` - Revenue by payment method
- `GET /api/super-admin-report/revenue/transactions` - Recent revenue transactions
- `GET /api/super-admin-report/revenue/summary` - Revenue summary

### Merchant Reports
- `GET /api/super-admin-report/merchants/summary` - Merchant summary
- `GET /api/super-admin-report/merchants/insights` - Merchant insights
- `GET /api/super-admin-report/merchants/top` - Top merchants
- `GET /api/super-admin-report/merchants/categories` - Merchants by category
- `GET /api/super-admin-report/merchants/recent` - Recent merchants
- `GET /api/super-admin-report/merchants/growth` - Merchant growth
- `GET /api/super-admin-report/merchants/category-distribution` - Category distribution

### Distributor Reports
- `GET /api/super-admin-report/distributors/summary` - Distributor summary
- `GET /api/super-admin-report/distributors/insights` - Distributor insights
- `GET /api/super-admin-report/distributors/top` - Top distributors
- `GET /api/super-admin-report/distributors/regional` - Regional performance
- `GET /api/super-admin-report/distributors/activities` - Distributor activities
- `GET /api/super-admin-report/distributors/performance` - Distributor performance
- `GET /api/super-admin-report/distributors/regional-distribution` - Regional distribution

### COD Reports
- `GET /api/super-admin-report/cod/summary` - COD summary
- `GET /api/super-admin-report/cod/trends` - COD trends
- `GET /api/super-admin-report/cod/reconciliation` - COD reconciliation status

### Export Reports
- `POST /api/super-admin-report/export` - Initiate export job
- `GET /api/super-admin-report/export/:jobId` - Get export status
- `GET /api/super-admin-report/export/download/:filename` - Download export file

## Authorization

All endpoints in this module require:
- Authentication (JWT token)
- Super Admin role

## File Structure

```
super-admin-report/
├── super-admin-report.controller.js    # HTTP request handlers
├── super-admin-report.service.js       # Business logic
├── super-admin-report.routes.js        # Route definitions
├── super-admin-report.validation.js    # Zod validation schemas
├── super-admin-report.constants.js     # Enums and constants
├── super-admin-report.swagger.js      # API documentation
├── index.js                            # Module exports
└── README.md                           # This file
```

## Implementation Status

- ✅ Module structure created
- ⏳ Controller placeholder methods
- ⏳ Service placeholder methods
- ⏳ Route registration
- ⏳ Validation schemas
- ⏳ Constants defined
- ⏳ Business logic implementation
- ⏳ Database queries
- ⏳ API documentation

## Notes

- This module is isolated and does not modify existing APIs
- All endpoints will follow the existing project architecture
- Database access will be implemented in the service layer
- Validation will use Zod schemas
- Export functionality will leverage existing export infrastructure
