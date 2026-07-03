# Razorpay Payment Integration Documentation

> Complete guide for Razorpay payment gateway integration in Vexaro Backend

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Setup & Configuration](#-setup--configuration)
- [API Endpoints](#-api-endpoints)
- [Payment Flow](#-payment-flow)
- [Webhook Integration](#-webhook-integration)
- [Testing](#-testing)
- [Security](#-security)
- [Error Handling](#-error-handling)

---

## 🎯 Overview

The Razorpay integration enables secure online wallet top-ups for Merchants and Distributors. It supports:
- Order creation
- Payment verification with signature validation
- Webhook-based payment confirmation
- Automatic wallet crediting
- Refund processing
- Payment history tracking

---

## ✨ Features

### Core Capabilities
- **Secure Payment Processing:** HMAC-SHA256 signature verification
- **Idempotent Operations:** Prevents double-crediting via unique order IDs
- **Webhook Support:** Handles payment.captured, payment.failed, order.paid events
- **Transaction Atomicity:** Uses MongoDB transactions for wallet updates
- **Role-Based Access:** Only MERCHANT and DISTRIBUTOR roles can top up
- **Automatic Notifications:** In-app notifications on successful payments
- **Refund Management:** Full and partial refund support
- **Comprehensive Audit Trail:** All payment events logged with metadata

### Technical Features
- **Payment Status Tracking:** PENDING → SUCCESS/FAILED/REFUNDED
- **Metadata Storage:** Stores complete Razorpay response for debugging
- **Error Recovery:** Graceful handling of Razorpay API failures
- **Multi-Currency Support:** Primarily INR with extensibility
- **Amount Limits:** Configurable max top-up amount (default: ₹1,00,000)
- **Signature Validation:** Timing-safe string comparison to prevent attacks

---

## 🏗 Architecture

### File Structure
```
src/modules/finance/
├── razorpay.service.js        # Core business logic
├── razorpay.controller.js     # HTTP handlers
├── razorpay.validation.js     # Zod schemas
├── payment.model.js           # Payment schema
├── finance.model.js           # Wallet & Transaction models
├── finance.service.js         # Wallet operations
└── wallet-payment.routes.js   # Public payment routes

src/modules/webhooks/
├── index.js                   # Webhook router
└── razorpay.webhook.js        # Razorpay webhook handler
```


### Database Schema

#### Payment Model
```javascript
{
  userId: ObjectId,              // User making the payment
  walletId: ObjectId,            // Target wallet
  razorpayOrderId: String,       // Unique Razorpay order ID
  razorpayPaymentId: String,     // Payment ID after completion
  signature: String,             // HMAC signature
  amount: Number,                // Amount in rupees
  amountRupees: Number,          // Same as amount
  amountPaise: Number,           // Amount in paise (×100)
  currency: String,              // Default: 'INR'
  status: String,                // PENDING | SUCCESS | FAILED | REFUNDED
  paymentMethod: String,         // upi, card, netbanking, etc.
  bank: String,                  // Bank name (if applicable)
  vpa: String,                   // UPI VPA
  razorpayPaymentStatus: String, // Razorpay's internal status
  capturedAt: Date,              // When payment was captured
  failureReason: String,         // Error message if failed
  failedAt: Date,                // Failure timestamp
  transactionId: ObjectId,       // Linked Transaction document
  metadata: Object,              // Full Razorpay payload
  webhookEventIds: [String],     // Webhook event IDs processed
  createdAt: Date,
  updatedAt: Date
}
```

#### Indexes
- `razorpayOrderId`: unique, for order lookups
- `razorpayPaymentId`: unique sparse, for webhook deduplication
- `userId + createdAt`: for payment history queries
- `userId + status + createdAt`: for filtered queries

---

## 🔐 Setup & Configuration

### 1. Install Dependencies
Already included in `package.json`:
```json
{
  "dependencies": {
    "razorpay": "^2.9.6"
  }
}
```

### 2. Environment Variables
Add to `.env` file:
```env
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
RAZORPAY_MAX_TOPUP_AMOUNT=100000
```

**Getting Razorpay Credentials:**
1. Sign up at [https://dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Navigate to **Settings → API Keys**
3. Generate test keys for development (`rzp_test_`)
4. Generate live keys for production (`rzp_live_`)

**Setting Up Webhooks:**
1. Go to **Settings → Webhooks**
2. Create a new webhook with URL: `https://yourdomain.com/api/webhooks/razorpay`
3. Select events: `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`
4. Copy the **Webhook Secret** to your `.env`

### 3. Verify Integration
Check health endpoint:
```bash
curl http://localhost:5000/health
```

---

## 🔌 API Endpoints

### 1. Create Razorpay Order
**POST** `/api/v1/wallet/razorpay/create-order`

Creates a Razorpay order and returns order details for frontend checkout.

**Authentication:** JWT (MERCHANT or DISTRIBUTOR)

**Request Body:**
```json
{
  "amount": 5000,
  "source": "checkout"
}
```

**Validation Rules:**
- `amount`: Number, min 100, max configured limit (default 100000)
- `source`: Optional enum ['checkout', 'upi_qr']

**Response (201):**
```json
{
  "success": true,
  "message": "Razorpay order created",
  "data": {
    "paymentId": "6745a1b2c3d4e5f6g7h8i9j0",
    "razorpayOrderId": "order_MNOPqrstuvwxyz",
    "orderId": "order_MNOPqrstuvwxyz",
    "amount": 500000,
    "amountRupees": 5000,
    "amountPaise": 500000,
    "currency": "INR",
    "keyId": "rzp_test_XXXXXXXX"
  }
}
```

**Error Responses:**
- `400`: Invalid amount or exceeds limit
- `403`: User role not authorized
- `404`: Wallet not found
- `503`: Razorpay not configured

---

### 2. Verify Payment
**POST** `/api/v1/wallet/razorpay/verify`

Verifies payment signature and credits wallet atomically.

**Authentication:** JWT (MERCHANT or DISTRIBUTOR)

**Request Body:**
```json
{
  "razorpayOrderId": "order_MNOPqrstuvwxyz",
  "razorpayPaymentId": "pay_ABCDefghijklmno",
  "razorpaySignature": "a1b2c3d4e5f6..."
}
```

**Alternative Field Names (all accepted):**
- `orderId` / `razorpay_order_id` for order
- `razorpay_payment_id` for payment
- `signature` / `razorpay_signature` for signature

**Response (200):**
```json
{
  "success": true,
  "message": "Payment verified and wallet credited",
  "data": {
    "success": true,
    "wallet": {
      "_id": "...",
      "balance": 15000,
      "currency": "INR"
    },
    "balance": 15000,
    "transaction": {
      "_id": "...",
      "type": "TOPUP",
      "amount": 5000,
      "reference": "RAZORPAY-pay_ABCDefghijklmno"
    },
    "payment": {
      "_id": "...",
      "status": "SUCCESS",
      "razorpayPaymentId": "pay_ABCDefghijklmno"
    }
  }
}
```

**Error Responses:**
- `400`: Invalid signature, amount mismatch, payment failed
- `404`: Payment record not found
- `409`: Payment already being processed

---

### 3. List Payments
**GET** `/api/v1/finance/payments`

Retrieves paginated payment history.

**Authentication:** JWT (MERCHANT, DISTRIBUTOR, SUPER_ADMIN)

**Query Parameters:**
```
?page=1
&limit=20
&status=SUCCESS
&dateFrom=2026-01-01
&dateTo=2026-12-31
&userId=6745a1b2c3d4e5f6g7h8i9j0  (SUPER_ADMIN only)
```

**Response (200):**
```json
{
  "success": true,
  "message": "Payments retrieved",
  "data": {
    "payments": [
      {
        "_id": "...",
        "userId": { "firstName": "John", "email": "john@example.com" },
        "amount": 5000,
        "status": "SUCCESS",
        "paymentMethod": "upi",
        "createdAt": "2026-07-03T10:30:00Z"
      }
    ]
  },
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
}
```

---

### 4. Get Payment Details
**GET** `/api/v1/finance/payments/:id`

Retrieves detailed payment information.

**Authentication:** JWT (payment owner or SUPER_ADMIN)

**Response (200):**
```json
{
  "success": true,
  "message": "Payment retrieved",
  "data": {
    "_id": "...",
    "userId": { "firstName": "John", "email": "john@example.com" },
    "walletId": { "balance": 15000, "currency": "INR" },
    "transactionId": {
      "type": "TOPUP",
      "amount": 5000,
      "balanceBefore": 10000,
      "balanceAfter": 15000
    },
    "razorpayOrderId": "order_...",
    "razorpayPaymentId": "pay_...",
    "status": "SUCCESS",
    "metadata": { "razorpay": {...} }
  }
}
```

---

### 5. Refund Payment
**POST** `/api/v1/finance/payments/:id/refund`

Processes a full or partial refund via Razorpay.

**Authentication:** JWT (payment owner or SUPER_ADMIN)

**Request Body:**
```json
{
  "amount": 2500,
  "reason": "Requested by customer"
}
```

**Validation:**
- `amount`: Optional, defaults to full payment amount
- `reason`: Required, min 5 chars, max 500 chars

**Response (200):**
```json
{
  "success": true,
  "message": "Payment refunded successfully",
  "data": {
    "success": true,
    "refund": {
      "id": "rfnd_...",
      "amount": 250000,
      "status": "processed"
    },
    "wallet": { "balance": 12500 },
    "transaction": {
      "type": "REFUND",
      "amount": 2500,
      "reference": "REFUND-rfnd_..."
    }
  }
}
```

---

## 💳 Payment Flow

### Frontend Integration Flow

#### Step 1: Create Order (Backend)
```javascript
const response = await fetch('/api/v1/wallet/razorpay/create-order', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ amount: 5000 })
});

const { data } = await response.json();
// data.razorpayOrderId, data.keyId, data.amount
```

#### Step 2: Open Razorpay Checkout (Frontend)
```javascript
const options = {
  key: data.keyId,
  amount: data.amount,
  currency: data.currency,
  order_id: data.razorpayOrderId,
  name: 'Vexaro Logistics',
  description: 'Wallet Top-up',
  handler: function(response) {
    // Payment successful, verify on backend
    verifyPayment(response);
  },
  prefill: {
    name: user.firstName + ' ' + user.lastName,
    email: user.email,
    contact: user.phone
  },
  theme: { color: '#3399cc' }
};

const rzp = new Razorpay(options);
rzp.open();
```

#### Step 3: Verify Payment (Backend)
```javascript
async function verifyPayment(response) {
  const verifyResponse = await fetch('/api/v1/wallet/razorpay/verify', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      razorpayOrderId: response.razorpay_order_id,
      razorpayPaymentId: response.razorpay_payment_id,
      razorpaySignature: response.razorpay_signature
    })
  });

  const result = await verifyResponse.json();
  if (result.success) {
    showSuccess('Wallet credited: ₹' + result.data.transaction.amount);
  }
}
```

---

## 🪝 Webhook Integration

### Webhook Endpoint
**POST** `/api/webhooks/razorpay`

Receives automated payment notifications from Razorpay.

### Supported Events
1. **payment.captured** - Payment successfully captured
2. **payment.failed** - Payment failed
3. **order.paid** - Order marked as paid
4. **refund.processed** - Refund completed

### Webhook Security
- **Signature Verification:** HMAC-SHA256 with webhook secret
- **Replay Protection:** Event IDs tracked to prevent duplicate processing
- **Timing-Safe Comparison:** Prevents timing attacks

### Sample Webhook Payload
```json
{
  "entity": "event",
  "account_id": "acc_...",
  "event": "payment.captured",
  "contains": ["payment"],
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_...",
        "amount": 500000,
        "currency": "INR",
        "status": "captured",
        "order_id": "order_...",
        "method": "upi",
        "captured": true
      }
    }
  },
  "created_at": 1234567890
}
```

### Webhook Response
Razorpay expects a `200 OK` response within 5 seconds.

```json
{
  "success": true,
  "message": "Webhook processed"
}
```

---

## 🧪 Testing

### Test Mode
Use test credentials for development:
```env
RAZORPAY_KEY_ID=rzp_test_XXXXXXXX
RAZORPAY_KEY_SECRET=test_secret_XXXXXXXX
```

### Test Cards
Razorpay provides test payment methods:

| Method | Details | Result |
|--------|---------|--------|
| **Card** | 4111 1111 1111 1111 | Success |
| **Card** | 4012 0010 0000 0001 | Success |
| **UPI** | success@razorpay | Success |
| **UPI** | failure@razorpay | Failure |
| **NetBanking** | Any bank | Success |

**Card CVV:** Any 3 digits  
**Expiry:** Any future date

### Manual Testing

#### 1. Test Order Creation
```bash
curl -X POST http://localhost:5000/api/v1/wallet/razorpay/create-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 500}'
```

#### 2. Test Webhook (Local)
```bash
curl -X POST http://localhost:5000/api/webhooks/razorpay \
  -H "X-Razorpay-Signature: valid_signature" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment.captured",
    "payload": {
      "payment": {
        "entity": {
          "id": "pay_test123",
          "order_id": "order_test456",
          "amount": 50000,
          "status": "captured",
          "captured": true
        }
      }
    }
  }'
```

---

## 🔒 Security

### Implemented Security Measures

1. **Signature Verification**
   - HMAC-SHA256 signing
   - Timing-safe comparison
   - Webhook signature validation

2. **Idempotency**
   - Unique `razorpayOrderId` constraint
   - Unique `razorpayPaymentId` constraint (sparse)
   - Webhook event ID tracking

3. **Access Control**
   - Role-based permissions (MERCHANT, DISTRIBUTOR only)
   - User can only access their own payments
   - SUPER_ADMIN can view all payments

4. **Amount Validation**
   - Min: ₹100
   - Max: Configurable (default ₹1,00,000)
   - Two decimal precision enforced

5. **Transaction Atomicity**
   - MongoDB sessions for wallet updates
   - Rollback on failure
   - Row-level locking

6. **Error Handling**
   - Sensitive data excluded from error messages
   - Razorpay errors mapped to HTTP status codes
   - Audit logging for all payment events

### Security Best Practices

**Production Checklist:**
- [ ] Rotate Razorpay keys monthly
- [ ] Use environment variables (never hardcode secrets)
- [ ] Enable webhook signature validation
- [ ] Set up Razorpay IP whitelisting
- [ ] Monitor for unusual payment patterns
- [ ] Enable 2FA on Razorpay dashboard
- [ ] Review payment logs weekly
- [ ] Set up alerts for failed payments

---

## ⚠️ Error Handling

### Common Errors & Solutions

| Error Code | Message | Solution |
|------------|---------|----------|
| `400` | Invalid signature | Frontend signature mismatch, retry payment |
| `400` | Amount mismatch | Razorpay amount differs from order |
| `400` | Payment not captured yet | Wait for webhook or retry verification |
| `403` | Only Merchants and Distributors can add money | User role check failed |
| `404` | Payment record not found | Order ID doesn't exist |
| `404` | Wallet not found | User wallet not initialized |
| `409` | Payment already being processed | Concurrent request detected |
| `502` | Razorpay API error | Razorpay service unavailable |
| `503` | Razorpay is not configured | Missing environment variables |

### Error Response Format
```json
{
  "success": false,
  "message": "Payment verification failed: invalid signature",
  "error": {
    "code": "INVALID_SIGNATURE_ERROR",
    "statusCode": 400
  }
}
```

### Razorpay Error Mapping
```javascript
const errorMap = {
  'BAD_REQUEST_ERROR': 400,
  'INVALID_SIGNATURE_ERROR': 400,
  'GATEWAY_ERROR': 502,
  'SERVER_ERROR': 502,
  'AUTHENTICATION_ERROR': 401,
  'AUTHORIZATION_ERROR': 403,
  'RATE_LIMIT_ERROR': 429
};
```

---

## 📊 Monitoring & Debugging

### Logging Events
The following events are logged with Winston:

- `razorpay_order_created` - Order creation success
- `razorpay_api_error` - Razorpay API failures
- `razorpay_webhook_ignored` - Unhandled webhook events
- `razorpay_payment_authorized` - Payment authorized (info)
- `payment_notification_failed` - Notification delivery failure

### Log Example
```javascript
logger.info('razorpay_order_created', {
  paymentId: '6745a1b2c3d4e5f6g7h8i9j0',
  userId: '6745...',
  razorpayOrderId: 'order_MNOPqrstuvwxyz',
  amountRupees: 5000,
  amountPaise: 500000
});
```

### Debugging Tips

1. **Payment Not Credited:**
   - Check webhook signature validation
   - Verify payment status in Razorpay dashboard
   - Review audit logs for WEBHOOK_RECEIVED event
   - Check if Payment document status is SUCCESS

2. **Duplicate Webhook Events:**
   - Webhooks are idempotent (event IDs tracked)
   - Check `webhookEventIds` array in Payment document

3. **Signature Verification Fails:**
   - Verify webhook secret matches Razorpay dashboard
   - Check if raw body parser is enabled for webhooks
   - Test signature with Razorpay's signature utility

4. **Transaction Rollback:**
   - MongoDB requires replica set for transactions
   - Check MongoDB connection string includes `?replicaSet=rs0`

---

## 🚀 Deployment Checklist

### Pre-Production
- [ ] Switch to live Razorpay keys (`rzp_live_`)
- [ ] Update `FRONTEND_URL` in production
- [ ] Configure webhook URL: `https://yourdomain.com/api/webhooks/razorpay`
- [ ] Add webhook events in Razorpay dashboard
- [ ] Set strong `RAZORPAY_WEBHOOK_SECRET`
- [ ] Test payment flow in staging
- [ ] Verify signature validation works
- [ ] Test webhook delivery
- [ ] Enable MongoDB replica set
- [ ] Set up error monitoring (Sentry)

### Production
- [ ] Monitor first 10 transactions closely
- [ ] Set up payment alerts (Slack/Email)
- [ ] Enable Razorpay dashboard notifications
- [ ] Review payment reconciliation reports
- [ ] Configure backup webhook URLs
- [ ] Document incident response procedures
- [ ] Train support team on refund process

### Post-Production
- [ ] Monitor webhook delivery rates
- [ ] Track payment success/failure rates
- [ ] Review refund request patterns
- [ ] Optimize database indexes if needed
- [ ] Update rate limits based on traffic
- [ ] Schedule key rotation policy

---

## 📚 Additional Resources

- [Razorpay API Documentation](https://razorpay.com/docs/api/)
- [Razorpay Checkout Integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/)
- [Webhook Signature Verification](https://razorpay.com/docs/webhooks/validate-test/)
- [Test Mode Guide](https://razorpay.com/docs/payments/payments/test-card-details/)
- [Razorpay Error Codes](https://razorpay.com/docs/api/errors/)

---

**Last Updated:** July 3, 2026  
**Version:** 1.0.0  
**Status:** ✅ Production Ready

