# Missing Backend APIs - Solution Document

## Problem Analysis

Your Angular frontend is calling API methods that don't exist in your backend. This is causing TypeScript compilation errors.

---

## Missing APIs Breakdown

### **1. Finance Module - Missing 6 APIs**

#### Backend File: `src/modules/finance/finance.routes.js`

**Missing Routes:**
1. `GET /api/v1/finance/admin-stats` - Get admin payment statistics
2. `GET /api/v1/finance/refunds` - List refund records (different from refund-requests)
3. `GET /api/v1/finance/recharge-requests` - List distributor recharge requests
4. `POST /api/v1/finance/recharge-distributor` - Recharge distributor wallet
5. `POST /api/v1/finance/recharge-requests/:id/approve` - Approve recharge request
6. `POST /api/v1/finance/recharge-requests/:id/reject` - Reject recharge request

---

### **2. Reports Module - Missing 25 APIs**

#### Backend File: `src/modules/reports/report.routes.js`

**Missing Routes:**

**General Reports:**
1. `GET /api/v1/reports/overview` - General reports overview

**Distributor Reports:**
2. `GET /api/v1/reports/distributor-insights` - Distributor analytics insights
3. `GET /api/v1/reports/top-distributors` - Top performing distributors
4. `GET /api/v1/reports/regional-performance` - Regional performance metrics
5. `GET /api/v1/reports/distributor-activities` - Recent distributor activities
6. `GET /api/v1/reports/distributor-performance` - Distributor performance metrics
7. `GET /api/v1/reports/regional-distribution` - Regional distribution breakdown

**Merchant Reports:**
8. `GET /api/v1/reports/merchant-summary` - Merchant summary statistics
9. `GET /api/v1/reports/merchant-insights` - Merchant analytics insights
10. `GET /api/v1/reports/top-merchants` - Top performing merchants
11. `GET /api/v1/reports/merchants-by-category` - Merchants grouped by category
12. `GET /api/v1/reports/recent-merchants` - Recently registered merchants
13. `GET /api/v1/reports/merchant-growth` - Merchant growth trends
14. `GET /api/v1/reports/merchant-category-distribution` - Category distribution

**Revenue Reports:**
15. `GET /api/v1/reports/revenue-summary` - Revenue summary statistics
16. `GET /api/v1/reports/revenue-insights` - Revenue analytics insights
17. `GET /api/v1/reports/top-revenue-merchants` - Top revenue generating merchants
18. `GET /api/v1/reports/revenue-by-payment-method` - Revenue breakdown by payment method
19. `GET /api/v1/reports/recent-revenue-transactions` - Recent revenue transactions
20. `GET /api/v1/reports/revenue-trend` - Revenue trend over time
21. `GET /api/v1/reports/revenue-source` - Revenue source breakdown

**Shipment Reports:**
22. `GET /api/v1/reports/shipment-summary` - Shipment summary statistics
23. `GET /api/v1/reports/shipment-trend` - Shipment trend over time
24. `GET /api/v1/reports/shipment-status` - Shipment status distribution
25. `GET /api/v1/reports/top-merchants-by-shipments` - Top merchants by shipment volume

---

## Solution Options

You have **3 options** to fix this:

### **Option 1: Add Missing Backend APIs (Recommended)**

This is the complete solution. You need to:

1. **Add Finance APIs**
   - Create controller methods in `finance.controller.js`
   - Create service methods in `finance.service.js`
   - Add routes in `finance.routes.js`

2. **Add Reports APIs**
   - Create controller methods in `report.controller.js`
   - Create service methods in `report.service.js`
   - Add routes in `report.routes.js`

### **Option 2: Update Frontend to Use Existing APIs**

Modify your Angular services to use the APIs that already exist:

**Existing Finance APIs you can use:**
- `/api/v1/finance/wallet` - Get wallet balance
- `/api/v1/finance/wallets` - List wallets
- `/api/v1/finance/transactions` - List transactions
- `/api/v1/finance/refund-requests` - List refund requests

**Existing Report APIs you can use:**
- `/api/v1/reports/shipments` - Shipment report
- `/api/v1/reports/revenue` - Revenue report
- `/api/v1/reports/merchant-revenue` - Merchant revenue

### **Option 3: Create Stub APIs (Quick Fix)**

Add stub endpoints that return empty data to make the app compile, then implement them later.

---

## Implementation Guide for Option 1

### Step 1: Add Finance Routes

Add to `src/modules/finance/finance.routes.js`:

```javascript
// Admin Stats
router.get('/admin-stats', 
  requireRole(UserRole.SUPER_ADMIN), 
  validateRequest({ query: emptyObjectSchema }), 
  c.getAdminStats
);

// Refunds (different from refund-requests)
router.get('/refunds', 
  requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR), 
  validateRequest({ query: schemas.listQuerySchema }), 
  c.listRefunds
);

// Recharge Requests
router.get('/recharge-requests', 
  requireRole(UserRole.SUPER_ADMIN), 
  validateRequest({ query: schemas.listQuerySchema }), 
  c.listRechargeRequests
);

router.post('/recharge-distributor', 
  requireRole(UserRole.SUPER_ADMIN), 
  validateRequest({ body: schemas.rechargeDistributorSchema }), 
  c.rechargeDistributorWallet
);

router.post('/recharge-requests/:id/approve', 
  requireRole(UserRole.SUPER_ADMIN), 
  validateRequest({ params: schemas.financeIdParamsSchema }), 
  c.approveRechargeRequest
);

router.post('/recharge-requests/:id/reject', 
  requireRole(UserRole.SUPER_ADMIN), 
  validateRequest({ params: schemas.financeIdParamsSchema, body: schemas.rejectReasonSchema }), 
  c.rejectRechargeRequest
);
```

### Step 2: Add Finance Controller Methods

Add to `src/modules/finance/finance.controller.js`:

```javascript
exports.getAdminStats = wrap(async (req, res) => 
  success(res, 'Admin stats retrieved', await getAdminStatsService(req.user))
);

exports.listRefunds = wrap(async (req, res) => {
  const query = req.validated.query;
  const { page, limit } = getPaginationParams(query, 20);
  const { items, total } = await listRefundsService(query, req.user);
  const meta = buildPaginationMeta(total, page, limit);
  paginated(res, 'Refunds retrieved', { refunds: items }, meta);
});

exports.listRechargeRequests = wrap(async (req, res) => {
  const query = req.validated.query;
  const { page, limit } = getPaginationParams(query, 20);
  const { items, total } = await listRechargeRequestsService(query, req.user);
  const meta = buildPaginationMeta(total, page, limit);
  paginated(res, 'Recharge requests retrieved', { requests: items }, meta);
});

exports.rechargeDistributorWallet = wrap(async (req, res) => 
  created(res, 'Distributor wallet recharged', await rechargeDistributorWalletService(req.validated.body, req.user))
);

exports.approveRechargeRequest = wrap(async (req, res) => 
  success(res, 'Recharge request approved', await approveRechargeRequestService(req.params.id, req.user))
);

exports.rejectRechargeRequest = wrap(async (req, res) => 
  success(res, 'Recharge request rejected', await rejectRechargeRequestService(req.params.id, req.validated.body, req.user))
);
```

### Step 3: Add Report Routes

Add to `src/modules/reports/report.routes.js`:

```javascript
// Overview
router.get('/overview', validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getReportsOverview));

// Distributor Reports
router.get('/distributor-insights', requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR), validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getDistributorInsights));
router.get('/top-distributors', requireRole(UserRole.SUPER_ADMIN), validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getTopDistributors));
router.get('/regional-performance', requireRole(UserRole.SUPER_ADMIN), validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getRegionalPerformance));
router.get('/distributor-activities', requireRole(UserRole.SUPER_ADMIN), validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getDistributorActivities));
router.get('/distributor-performance', requireRole(UserRole.SUPER_ADMIN), validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getDistributorPerformance));
router.get('/regional-distribution', requireRole(UserRole.SUPER_ADMIN), validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getRegionalDistribution));

// Merchant Reports
router.get('/merchant-summary', validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getMerchantSummary));
router.get('/merchant-insights', validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getMerchantInsights));
router.get('/top-merchants', requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR), validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getTopMerchants));
router.get('/merchants-by-category', requireRole(UserRole.SUPER_ADMIN), validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getMerchantsByCategory));
router.get('/recent-merchants', requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR), validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getRecentMerchants));
router.get('/merchant-growth', requireRole(UserRole.SUPER_ADMIN), validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getMerchantGrowth));
router.get('/merchant-category-distribution', requireRole(UserRole.SUPER_ADMIN), validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getMerchantCategoryDistribution));

// Revenue Reports
router.get('/revenue-summary', validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getRevenueSummary));
router.get('/revenue-insights', validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getRevenueInsights));
router.get('/top-revenue-merchants', requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR), validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getTopRevenueMerchants));
router.get('/revenue-by-payment-method', requireRole(UserRole.SUPER_ADMIN), validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getRevenueByPaymentMethod));
router.get('/recent-revenue-transactions', validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getRecentRevenueTransactions));
router.get('/revenue-trend', validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getRevenueTrend));
router.get('/revenue-source', validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getRevenueSource));

// Shipment Reports
router.get('/shipment-summary', validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getShipmentSummary));
router.get('/shipment-trend', validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getShipmentTrend));
router.get('/shipment-status', validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getShipmentStatus));
router.get('/top-merchants-by-shipments', requireRole(UserRole.SUPER_ADMIN, UserRole.DISTRIBUTOR), validateRequest({ query: schemas.reportQueryDto }), wrap(reportController.getTopMerchantsByShipments));
```

---

## Quick Fix (Option 3) - Stub Implementation

If you need the app running ASAP, add stub controllers that return empty data:

```javascript
// In finance.controller.js
exports.getAdminStats = wrap(async (req, res) => 
  success(res, 'Admin stats', { 
    totalRevenue: 0, 
    totalRefunds: 0, 
    pendingRecharges: 0 
  })
);

// In report.controller.js
exports.getReportsOverview = async (req, res) => {
  success(res, 'Reports overview', { 
    totalShipments: 0, 
    totalRevenue: 0, 
    totalMerchants: 0 
  });
};
```

---

## Recommended Action Plan

1. **Immediate** - Use Option 3 (stubs) to get the app running
2. **Short-term** - Implement Option 1 for critical APIs (admin-stats, recharge-requests)
3. **Long-term** - Implement all missing APIs with proper business logic

---

## Need Help?

If you want me to implement any of these APIs, let me know which ones are priority and I'll create the full implementation with:
- Routes
- Controllers
- Services
- Database queries
- Validation schemas
