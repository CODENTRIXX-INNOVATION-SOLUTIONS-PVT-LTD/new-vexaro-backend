# Distributor API Quick Reference

## **DISTRIBUTOR-EXCLUSIVE APIs (7 endpoints)**

### Warehouse Management
```
GET    /api/v1/users/distributor/warehouse-change-requests
POST   /api/v1/users/distributor/warehouse-change-requests/:requestId/approve
POST   /api/v1/users/distributor/warehouse-change-requests/:requestId/reject
```

### Finance Operations
```
POST   /api/v1/finance/transfer-to-merchant
POST   /api/v1/finance/topup
PATCH  /api/v1/finance/cod/:id/remit
```

### Rate Management
```
POST   /api/v1/rates/margins
```

---

## **DISTRIBUTOR + SUPER_ADMIN APIs (15 endpoints)**

### Wallet & Finance
```
GET    /api/v1/finance/wallets
GET    /api/v1/finance/refunds
POST   /api/v1/finance/settlements
PATCH  /api/v1/finance/refund-requests/:id/process
```

### Reports & Analytics
```
GET    /api/v1/reports/merchant-revenue
GET    /api/v1/reports/distributor-insights
GET    /api/v1/reports/top-merchants
GET    /api/v1/reports/recent-merchants
GET    /api/v1/reports/top-revenue-merchants
GET    /api/v1/reports/top-merchants-by-shipments
```

### Disputes
```
PATCH  /api/v1/disputes/weight-dispute/:id/resolve
```

### Support
```
PATCH  /api/v1/support/:id
```

### Rates
```
GET    /api/v1/rates/margins
```

### Razorpay Payment
```
POST   /api/v1/finance/razorpay/create-order
POST   /api/v1/finance/razorpay/verify-payment
```

---

## **ALL AUTHENTICATED USER APIs (70+ endpoints)**

### Authentication (9)
```
POST   /api/v1/auth/login
GET    /api/v1/auth/verify-invite
POST   /api/v1/auth/set-password
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
GET    /api/v1/auth/me
POST   /api/v1/auth/change-initial-credentials
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
```

### User Management (10)
```
POST   /api/v1/users/invite
GET    /api/v1/users
GET    /api/v1/users/:id
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id
POST   /api/v1/users/:id/resend-invite
PATCH  /api/v1/users/:id/reactivate
GET    /api/v1/users/:id/warehouse
PATCH  /api/v1/users/:id/warehouse
```

### Shipments (16)
```
GET    /api/v1/shipments
POST   /api/v1/shipments
GET    /api/v1/shipments/stats
GET    /api/v1/shipments/track/:awb
POST   /api/v1/shipments/bulk-upload
GET    /api/v1/shipments/bulk-status/:jobId
POST   /api/v1/shipments/serviceability
POST   /api/v1/shipments/velocity-rates
POST   /api/v1/shipments/reverse
GET    /api/v1/shipments/:id
PATCH  /api/v1/shipments/:id
DELETE /api/v1/shipments/:id
PATCH  /api/v1/shipments/:id/status
```

### Rates (3)
```
GET    /api/v1/rates/cards
GET    /api/v1/rates/cards/:id
POST   /api/v1/rates/calculate
```

### Finance (6)
```
GET    /api/v1/finance/wallet
GET    /api/v1/finance/transactions
GET    /api/v1/finance/cod
GET    /api/v1/finance/settlements
GET    /api/v1/finance/refund-requests
GET    /api/v1/finance/payments
GET    /api/v1/finance/payments/:id
```

### Disputes (4)
```
GET    /api/v1/disputes
POST   /api/v1/disputes
GET    /api/v1/disputes/:id
PATCH  /api/v1/disputes/:id
GET    /api/v1/disputes/weight-dispute
```

### Reports (12)
```
GET    /api/v1/reports/shipments
GET    /api/v1/reports/revenue
GET    /api/v1/reports/performance
GET    /api/v1/reports/wallet
GET    /api/v1/reports/cod
GET    /api/v1/reports/payment
GET    /api/v1/reports/export/shipments
GET    /api/v1/reports/export/revenue
POST   /api/v1/reports/export
GET    /api/v1/reports/export/:jobId
GET    /api/v1/reports/export/download/:filename
```

### Support (5)
```
GET    /api/v1/support
POST   /api/v1/support/upload
POST   /api/v1/support
GET    /api/v1/support/:id
POST   /api/v1/support/:id/reply
```

### Notifications (4)
```
GET    /api/v1/notifications
PATCH  /api/v1/notifications/mark-read
PATCH  /api/v1/notifications/:id/read
DELETE /api/v1/notifications/:id
```

### Settings (8)
```
GET    /api/v1/settings/profile
PATCH  /api/v1/settings/profile
POST   /api/v1/settings/change-password
GET    /api/v1/settings/api-keys
POST   /api/v1/settings/api-keys
DELETE /api/v1/settings/api-keys/:id
GET    /api/v1/settings/notifications
PATCH  /api/v1/settings/notifications
```

---

## **Key Distributor Capabilities**

1. ✅ **Merchant Management** - Invite, manage, view merchant details
2. ✅ **Wallet Operations** - Top-up merchant wallets, transfer funds
3. ✅ **COD Management** - Remit COD amounts to merchants
4. ✅ **Warehouse Approvals** - Approve/reject warehouse address changes
5. ✅ **Margin Configuration** - Set custom margins on rate cards
6. ✅ **Settlement Requests** - Request fund settlements
7. ✅ **Refund Processing** - Approve/reject merchant refund requests
8. ✅ **Dispute Resolution** - Resolve weight disputes
9. ✅ **Merchant Reports** - View per-merchant revenue and performance
10. ✅ **Support Management** - Manage and respond to support tickets
11. ✅ **Razorpay Integration** - Self-service wallet top-up via payment gateway
12. ✅ **Complete Shipment Lifecycle** - Create, track, manage shipments

---

## **Authentication**

All APIs require JWT token (except public endpoints):

```bash
# Login
POST /api/v1/auth/login
{
  "email": "distributor@example.com",
  "password": "your-password"
}

# Use token in subsequent requests
Authorization: Bearer <token>
```

---

## **Base URL**

- Development: `http://localhost:5000`
- Production: Configure in `.env` file

---

## **Total Count**

- **Distributor-Exclusive:** 7 APIs
- **Distributor + Super Admin:** 15 APIs
- **All Authenticated:** 70+ APIs
- **Total Accessible by Distributor:** ~95+ APIs

---

*This is a quick reference. See DISTRIBUTOR_API_LIST.md for complete details with request/response examples.*
