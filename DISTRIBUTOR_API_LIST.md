# Complete Distributor API List

This document lists ALL APIs accessible by users with `DISTRIBUTOR` role in your Vexaro backend.

---

## **AUTHENTICATION APIs** (`/api/v1/auth`)

All authentication endpoints (no role restriction):

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Login with email and password |
| GET | `/api/v1/auth/verify-invite` | Verify invite token validity |
| POST | `/api/v1/auth/set-password` | Set password after invite acceptance |
| POST | `/api/v1/auth/forgot-password` | Request password reset email |
| POST | `/api/v1/auth/reset-password` | Reset password with token |
| GET | `/api/v1/auth/me` | Get current authenticated user profile |
| POST | `/api/v1/auth/change-initial-credentials` | Change initial credentials |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Logout and invalidate refresh token |

---

## **USER MANAGEMENT APIs** (`/api/v1/users`)

### General User Management (All Authenticated Users)

| Method | Endpoint | Description | Query/Body Params |
|--------|----------|-------------|-------------------|
| POST | `/api/v1/users/invite` | Invite new user (merchant/warehouse) | `email`, `role`, `name` |
| GET | `/api/v1/users` | List all users (paginated) | `page`, `pageSize`, `role`, `status` |
| GET | `/api/v1/users/:id` | Get user details by ID | - |
| PATCH | `/api/v1/users/:id` | Update user profile | `name`, `email`, `phone` |
| DELETE | `/api/v1/users/:id` | Deactivate user account | - |
| POST | `/api/v1/users/:id/resend-invite` | Resend invitation email | - |
| PATCH | `/api/v1/users/:id/reactivate` | Reactivate deactivated user | - |
| GET | `/api/v1/users/:id/warehouse` | View merchant warehouse details | - |
| PATCH | `/api/v1/users/:id/warehouse` | Update merchant warehouse | `contactPerson`, `phone`, `email`, `address` |

### Distributor-Specific Warehouse Management

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/v1/users/distributor/warehouse-change-requests` | List warehouse address change requests | DISTRIBUTOR only |
| POST | `/api/v1/users/distributor/warehouse-change-requests/:requestId/approve` | Approve warehouse address change | DISTRIBUTOR only |
| POST | `/api/v1/users/distributor/warehouse-change-requests/:requestId/reject` | Reject warehouse address change with reason | DISTRIBUTOR only |

**Query Params for listing requests:**
- `page` - Page number (default: 1)
- `pageSize` - Items per page (default: 20)
- `status` - Filter by status: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`

---

## **SHIPMENT MANAGEMENT APIs** (`/api/v1/shipments`)

### General Shipment Operations (All Authenticated)

| Method | Endpoint | Description | Query/Body Params |
|--------|----------|-------------|-------------------|
| GET | `/api/v1/shipments/stats` | Get shipment dashboard statistics | - |
| GET | `/api/v1/shipments/track/:awb` | Track shipment by AWB number | - |
| GET | `/api/v1/shipments/bulk-status/:jobId` | Get bulk upload job status | - |
| POST | `/api/v1/shipments/serviceability` | Check if route is serviceable | `originPincode`, `destPincode` |
| POST | `/api/v1/shipments/velocity-rates` | Get Velocity shipping rates | `originPincode`, `destPincode`, `weight` |
| GET | `/api/v1/shipments` | List shipments (role-scoped) | `page`, `pageSize`, `status`, `dateFrom`, `dateTo` |
| GET | `/api/v1/shipments/:id` | Get single shipment details | - |
| PATCH | `/api/v1/shipments/:id/status` | Update shipment status | `status`, `remarks` |

### Distributor Can Create/Modify (with SUPER_ADMIN, MERCHANT)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/v1/shipments/bulk-upload` | Bulk upload shipments via CSV | SUPER_ADMIN, DISTRIBUTOR, MERCHANT |
| POST | `/api/v1/shipments/reverse` | Create reverse/return shipment | SUPER_ADMIN, DISTRIBUTOR, MERCHANT |
| POST | `/api/v1/shipments` | Create new shipment | SUPER_ADMIN, DISTRIBUTOR, MERCHANT |
| PATCH | `/api/v1/shipments/:id` | Update shipment details | SUPER_ADMIN, DISTRIBUTOR, MERCHANT |
| DELETE | `/api/v1/shipments/:id` | Soft delete shipment (CREATED only) | SUPER_ADMIN, DISTRIBUTOR, MERCHANT |

**Create Shipment Body:**
- `origin` - Origin address details
- `destination` - Destination address details
- `weight` - Package weight in kg
- `declaredValue` - Declared value
- `isCOD` - Cash on delivery flag
- `codAmount` - COD amount if applicable
- `serviceType` - STANDARD, EXPRESS, SAME_DAY

---

## **RATE MANAGEMENT APIs** (`/api/v1/rates`)

### Rate Cards (View Only for Distributor)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/v1/rates/cards` | List all rate cards | All authenticated |
| GET | `/api/v1/rates/cards/:id` | Get rate card by ID | All authenticated |
| POST | `/api/v1/rates/calculate` | Calculate shipping cost | All authenticated |

### Margin Configuration (Distributor Exclusive)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/v1/rates/margins` | Get own margin configurations | SUPER_ADMIN, DISTRIBUTOR |
| POST | `/api/v1/rates/margins` | Create/update margin config | DISTRIBUTOR only |

**Margin Config Body:**
- `rateCardId` - Rate card to apply margin to
- `marginPercentage` - Margin percentage to add
- `isActive` - Enable/disable margin

---

## **FINANCE & WALLET APIs** (`/api/v1/finance`)

### Wallet Management

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/v1/finance/wallet` | Get own wallet balance | All authenticated |
| GET | `/api/v1/finance/wallets` | List all wallets (in scope) | SUPER_ADMIN, DISTRIBUTOR |
| POST | `/api/v1/finance/topup` | Top-up merchant wallet | SUPER_ADMIN, DISTRIBUTOR |
| POST | `/api/v1/finance/transfer-to-merchant` | Transfer funds to merchant | DISTRIBUTOR only |

**Top-up Body:**
- `userId` - Target user ID
- `amount` - Amount to top-up
- `reference` - Reference/description

**Transfer Body:**
- `merchantId` - Target merchant ID
- `amount` - Amount to transfer

### Transaction Management

| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/v1/finance/transactions` | List own transactions | `page`, `pageSize`, `type`, `dateFrom`, `dateTo`, `userId` (SA/Dist) |

### COD Management

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/v1/finance/cod` | List COD records (role-scoped) | All authenticated |
| PATCH | `/api/v1/finance/cod/:id/remit` | Remit COD to merchant wallet | SUPER_ADMIN, DISTRIBUTOR |

**Remit Body:**
- `remittedAmount` - Amount to remit
- `transactionReference` - Bank/payment reference

### Settlements

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/v1/finance/settlements` | List settlements | All authenticated |
| POST | `/api/v1/finance/settlements` | Create settlement request | SUPER_ADMIN, DISTRIBUTOR |

**Settlement Body:**
- `amount` - Amount to settle
- `bankDetails` - Bank account details

### Refund Request Management

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/v1/finance/refund-requests` | List refund requests (role-scoped) | All authenticated |
| PATCH | `/api/v1/finance/refund-requests/:id/process` | Approve/reject refund request | SUPER_ADMIN, DISTRIBUTOR |

**Process Refund Body:**
- `action` - `APPROVE` or `REJECT`
- `reason` - Reason for rejection (if applicable)

### Razorpay Payment Integration (Distributor + Merchant)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/v1/finance/razorpay/create-order` | Create Razorpay order for wallet top-up | MERCHANT, DISTRIBUTOR |
| POST | `/api/v1/finance/razorpay/verify-payment` | Verify payment and credit wallet | MERCHANT, DISTRIBUTOR |
| GET | `/api/v1/finance/payments` | List payment history | All authenticated |
| GET | `/api/v1/finance/payments/:id` | Get payment details | All authenticated |

**Create Order Body:**
- `amount` - Amount in rupees

**Verify Payment Body:**
- `razorpay_order_id` - Order ID
- `razorpay_payment_id` - Payment ID
- `razorpay_signature` - Payment signature

### Admin Stats & Recharge (NEW - STUB)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/v1/finance/admin-stats` | Get admin payment statistics | SUPER_ADMIN |
| GET | `/api/v1/finance/refunds` | List refund records | SUPER_ADMIN, DISTRIBUTOR |
| GET | `/api/v1/finance/recharge-requests` | List distributor recharge requests | SUPER_ADMIN |
| POST | `/api/v1/finance/recharge-distributor` | Recharge distributor wallet | SUPER_ADMIN |
| POST | `/api/v1/finance/recharge-requests/:id/approve` | Approve recharge request | SUPER_ADMIN |
| POST | `/api/v1/finance/recharge-requests/:id/reject` | Reject recharge request | SUPER_ADMIN |

---

## **DISPUTE MANAGEMENT APIs** (`/api/v1/disputes`)

### Standard Disputes (All Authenticated)

| Method | Endpoint | Description | Query/Body Params |
|--------|----------|-------------|-------------------|
| GET | `/api/v1/disputes` | List all disputes (role-scoped) | `page`, `pageSize`, `status`, `category` |
| POST | `/api/v1/disputes` | Create new dispute | `shipmentId`, `category`, `description` |
| GET | `/api/v1/disputes/:id` | Get dispute details | - |
| PATCH | `/api/v1/disputes/:id` | Update dispute | `status`, `resolution` |

### Weight Disputes

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/v1/disputes/weight-dispute` | List weight disputes | All authenticated |
| PATCH | `/api/v1/disputes/weight-dispute/:id/resolve` | Resolve weight dispute | SUPER_ADMIN, DISTRIBUTOR |

**Resolve Weight Dispute Body:**
- `resolution` - Resolution decision
- `finalWeight` - Approved weight
- `remarks` - Resolution remarks

---

## **REPORTS & ANALYTICS APIs** (`/api/v1/reports`)

### General Reports (All Authenticated)

| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/v1/reports/shipments` | Shipment volume & status breakdown | `dateFrom`, `dateTo`, `merchantId`, `distributorId` |
| GET | `/api/v1/reports/revenue` | Own wallet credit/debit breakdown | `dateFrom`, `dateTo` |
| GET | `/api/v1/reports/performance` | Delivery times & weekly trends | `dateFrom`, `dateTo` |
| GET | `/api/v1/reports/wallet` | Wallet balance & ledger summaries | `dateFrom`, `dateTo` |
| GET | `/api/v1/reports/cod` | COD collected vs remittance status | `dateFrom`, `dateTo` |
| GET | `/api/v1/reports/payment` | Razorpay top-up success metrics | `dateFrom`, `dateTo` |

### Distributor-Accessible Reports (SUPER_ADMIN + DISTRIBUTOR)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/v1/reports/merchant-revenue` | Per-merchant shipment + COD stats | SUPER_ADMIN, DISTRIBUTOR |
| GET | `/api/v1/reports/distributor-insights` | Distributor analytics insights (NEW) | SUPER_ADMIN, DISTRIBUTOR |

### Export APIs (All Authenticated)

| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/v1/reports/export/shipments` | Streaming CSV export of shipments | `dateFrom`, `dateTo`, `merchantId`, `distributorId` |
| GET | `/api/v1/reports/export/revenue` | Streaming CSV export of transactions | `dateFrom`, `dateTo`, `userId` |
| POST | `/api/v1/reports/export` | Create async export job | `reportType`, `dateFrom`, `dateTo` |
| GET | `/api/v1/reports/export/:jobId` | Poll export job status | - |
| GET | `/api/v1/reports/export/download/:filename` | Download completed export file | - |

**Export Job Body:**
- `reportType` - `shipments` or `revenue`
- `dateFrom` - Start date
- `dateTo` - End date
- `filters` - Additional filters (optional)

### New Report APIs (STUB - To Be Implemented)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/v1/reports/overview` | General reports overview | All authenticated |
| GET | `/api/v1/reports/top-distributors` | Top performing distributors | SUPER_ADMIN |
| GET | `/api/v1/reports/regional-performance` | Regional performance metrics | SUPER_ADMIN |
| GET | `/api/v1/reports/distributor-activities` | Recent distributor activities | SUPER_ADMIN |
| GET | `/api/v1/reports/distributor-performance` | Distributor performance metrics | SUPER_ADMIN |
| GET | `/api/v1/reports/regional-distribution` | Regional distribution breakdown | SUPER_ADMIN |
| GET | `/api/v1/reports/merchant-summary` | Merchant summary statistics | All authenticated |
| GET | `/api/v1/reports/merchant-insights` | Merchant analytics insights | All authenticated |
| GET | `/api/v1/reports/top-merchants` | Top performing merchants | SUPER_ADMIN, DISTRIBUTOR |
| GET | `/api/v1/reports/merchants-by-category` | Merchants grouped by category | SUPER_ADMIN |
| GET | `/api/v1/reports/recent-merchants` | Recently registered merchants | SUPER_ADMIN, DISTRIBUTOR |
| GET | `/api/v1/reports/merchant-growth` | Merchant growth trends | SUPER_ADMIN |
| GET | `/api/v1/reports/merchant-category-distribution` | Category distribution | SUPER_ADMIN |
| GET | `/api/v1/reports/revenue-summary` | Revenue summary statistics | All authenticated |
| GET | `/api/v1/reports/revenue-insights` | Revenue analytics insights | All authenticated |
| GET | `/api/v1/reports/top-revenue-merchants` | Top revenue merchants | SUPER_ADMIN, DISTRIBUTOR |
| GET | `/api/v1/reports/revenue-by-payment-method` | Revenue by payment method | SUPER_ADMIN |
| GET | `/api/v1/reports/recent-revenue-transactions` | Recent revenue transactions | All authenticated |
| GET | `/api/v1/reports/revenue-trend` | Revenue trend over time | All authenticated |
| GET | `/api/v1/reports/revenue-source` | Revenue source breakdown | All authenticated |
| GET | `/api/v1/reports/shipment-summary` | Shipment summary statistics | All authenticated |
| GET | `/api/v1/reports/shipment-trend` | Shipment trend over time | All authenticated |
| GET | `/api/v1/reports/shipment-status` | Shipment status distribution | All authenticated |
| GET | `/api/v1/reports/top-merchants-by-shipments` | Top merchants by shipment volume | SUPER_ADMIN, DISTRIBUTOR |

---

## **SUPPORT & TICKETING APIs** (`/api/v1/support`)

### General Support (All Authenticated)

| Method | Endpoint | Description | Query/Body Params |
|--------|----------|-------------|-------------------|
| GET | `/api/v1/support` | List support tickets (role-scoped) | `page`, `pageSize`, `status`, `priority`, `category` |
| POST | `/api/v1/support/upload` | Upload file attachment | File upload |
| POST | `/api/v1/support` | Create support ticket | `subject`, `category`, `priority`, `description`, `attachments` |
| GET | `/api/v1/support/:id` | Get ticket details | - |
| POST | `/api/v1/support/:id/reply` | Add reply to ticket | `message`, `attachments` |

### Distributor Support Management (SUPER_ADMIN + DISTRIBUTOR)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| PATCH | `/api/v1/support/:id` | Update ticket status/assignment | SUPER_ADMIN, DISTRIBUTOR |

**Update Ticket Body:**
- `status` - `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`
- `assignedTo` - User ID to assign ticket
- `priority` - Change priority level

---

## **NOTIFICATIONS APIs** (`/api/v1/notifications`)

All notification endpoints (All Authenticated):

| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/v1/notifications` | Get own notifications (unread first) | `page`, `pageSize`, `type`, `isRead` |
| PATCH | `/api/v1/notifications/mark-read` | Mark all notifications as read | `notificationIds` (optional) |
| PATCH | `/api/v1/notifications/:id/read` | Mark single notification as read | - |
| DELETE | `/api/v1/notifications/:id` | Delete notification | - |

---

## **SETTINGS & PROFILE APIs** (`/api/v1/settings`)

All settings endpoints (All Authenticated):

| Method | Endpoint | Description | Body Params |
|--------|----------|-------------|-------------|
| GET | `/api/v1/settings/profile` | Get own profile | - |
| PATCH | `/api/v1/settings/profile` | Update profile | `name`, `phone`, `email`, `companyName` |
| POST | `/api/v1/settings/change-password` | Change password | `currentPassword`, `newPassword` |
| GET | `/api/v1/settings/api-keys` | List own API keys | - |
| POST | `/api/v1/settings/api-keys` | Create API key | `name`, `description` |
| DELETE | `/api/v1/settings/api-keys/:id` | Revoke API key | - |
| GET | `/api/v1/settings/notifications` | Get notification preferences | - |
| PATCH | `/api/v1/settings/notifications` | Update notification preferences | `email`, `sms`, `push` settings |

---

## **SUMMARY**

### **Total APIs Accessible by DISTRIBUTOR: ~95+**

### **Distributor-Exclusive APIs: 7**
1. Transfer funds to merchant
2. Approve warehouse address change
3. Reject warehouse address change
4. List warehouse change requests
5. Create margin configuration
6. Top-up merchant wallet
7. Remit COD to merchant

### **Shared with SUPER_ADMIN: 15+**
- Wallet listing
- Top-up management
- COD remittance
- Settlement creation
- Refund request processing
- Weight dispute resolution
- Merchant revenue reports
- Support ticket management
- Advanced analytics reports

### **Available to All Authenticated Users: 70+**
- All authentication endpoints
- Basic user management
- Shipment operations
- Transaction viewing
- Dispute creation
- Report generation
- Notifications
- Profile settings

---

## **API Authentication**

All APIs (except login, verify-invite, set-password, forgot-password, reset-password) require:

**Header:** `Authorization: Bearer <JWT_TOKEN>`

**Token obtained from:** `POST /api/v1/auth/login`

---

## **Common Response Format**

### Success Response:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Paginated Response:
```json
{
  "success": true,
  "message": "Data retrieved",
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Response:
```json
{
  "success": false,
  "message": "Error message",
  "errors": [ ... ]
}
```

---

## **Base URL**

Development: `http://localhost:5000`
Production: `https://api.vexaro.com` (configure in .env)

---

*Last Updated: July 2, 2026*
*Backend Version: 1.0.0*
