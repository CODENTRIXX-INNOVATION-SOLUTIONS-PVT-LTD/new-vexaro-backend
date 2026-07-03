# Razorpay Payment Flow Diagram

## 📱 Complete Payment Flow

```
┌─────────────┐
│   Frontend  │
│   (User)    │
└──────┬──────┘
       │
       │ 1. Click "Add Money"
       │    Amount: ₹500
       │
       ▼
┌──────────────────────────────────────┐
│  POST /razorpay/create-order         │
│  Body: { amount: 500 }               │
└──────┬───────────────────────────────┘
       │
       │ 2. Validate amount & role
       │    Create Payment record
       │
       ▼
┌──────────────────────────────────────┐
│  Razorpay API                        │
│  orders.create()                     │
└──────┬───────────────────────────────┘
       │
       │ 3. Return order_id
       │
       ▼
┌──────────────────────────────────────┐
│  Response to Frontend                │
│  {                                   │
│    razorpayOrderId: "order_123",     │
│    keyId: "rzp_test_xxx",            │
│    amount: 50000                     │
│  }                                   │
└──────┬───────────────────────────────┘
       │
       │ 4. Open Razorpay Checkout Modal
       │
       ▼
┌──────────────────────────────────────┐
│  Razorpay Checkout UI                │
│  - Select payment method             │
│  - Enter payment details             │
│  - Complete payment                  │
└──────┬───────────────────────────────┘
       │
       │ 5. Payment Success
       │    Returns: order_id, payment_id, signature
       │
       ▼
┌──────────────────────────────────────┐
│  POST /razorpay/verify               │
│  Body: {                             │
│    razorpayOrderId,                  │
│    razorpayPaymentId,                │
│    razorpaySignature                 │
│  }                                   │
└──────┬───────────────────────────────┘
       │
       │ 6. Verify signature (HMAC-SHA256)
       │    Check payment status
       │
       ▼
┌──────────────────────────────────────┐
│  MongoDB Transaction                 │
│  - Update Payment status → SUCCESS   │
│  - Create Transaction record         │
│  - Credit Wallet balance             │
│  - Create Notification               │
└──────┬───────────────────────────────┘
       │
       │ 7. Return success
       │
       ▼
┌──────────────────────────────────────┐
│  Frontend                            │
│  Show: "✅ Wallet credited: ₹500"    │
└──────────────────────────────────────┘
```

---

## 🪝 Webhook Flow (Asynchronous)

```
┌──────────────┐
│  Razorpay    │
│  Server      │
└──────┬───────┘
       │
       │ Payment captured on Razorpay
       │
       ▼
┌──────────────────────────────────────┐
│  POST /api/webhooks/razorpay         │
│  Headers:                            │
│    X-Razorpay-Signature              │
│  Body:                               │
│    {                                 │
│      event: "payment.captured",      │
│      payload: { payment: {...} }     │
│    }                                 │
└──────┬───────────────────────────────┘
       │
       │ 1. Verify webhook signature
       │
       ▼
┌──────────────────────────────────────┐
│  Signature Valid?                    │
└──────┬───────────────────┬───────────┘
       │ YES               │ NO
       ▼                   ▼
   Continue           Return 400
       │
       │ 2. Find Payment record by order_id
       │
       ▼
┌──────────────────────────────────────┐
│  Payment Status Check                │
└──────┬───────────────────┬───────────┘
       │ PENDING           │ SUCCESS
       ▼                   ▼
   Process           Already processed
       │              (idempotent)
       │
       │ 3. Fetch payment from Razorpay
       │    Validate amount, currency
       │
       ▼
┌──────────────────────────────────────┐
│  MongoDB Transaction                 │
│  - Update Payment → SUCCESS          │
│  - Create Transaction                │
│  - Credit Wallet                     │
│  - Track webhook event ID            │
└──────┬───────────────────────────────┘
       │
       │ 4. Return 200 OK
       │
       ▼
┌──────────────────────────────────────┐
│  Razorpay                            │
│  Marks webhook as delivered          │
└──────────────────────────────────────┘
```

---

## 💳 Database Flow

```
┌─────────────────┐
│  Payment Model  │
├─────────────────┤
│ status: PENDING │ ◄─── Created on order creation
│ razorpayOrderId │
│ amount          │
│ userId          │
└────────┬────────┘
         │
         │ Payment successful
         │
         ▼
┌─────────────────┐
│  Payment Model  │
├─────────────────┤
│ status: SUCCESS │ ◄─── Updated on verification
│ razorpayPaymentId│
│ signature       │
│ transactionId   │ ──┐
│ capturedAt      │   │
└─────────────────┘   │
                      │
         ┌────────────┘
         │
         ▼
┌─────────────────┐       ┌──────────────┐
│  Transaction    │       │   Wallet     │
├─────────────────┤       ├──────────────┤
│ type: TOPUP     │◄─────►│ balance +=   │
│ amount: 500     │       │   500        │
│ reference       │       │ userId       │
│ userId          │       └──────────────┘
│ balanceBefore   │
│ balanceAfter    │
└─────────────────┘
         │
         │
         ▼
┌─────────────────┐
│  Notification   │
├─────────────────┤
│ type: PAYMENT   │
│ title: Wallet   │
│   Topped Up     │
│ userId          │
└─────────────────┘
```

---

## 🔄 Refund Flow

```
┌─────────────┐
│   Admin/    │
│   User      │
└──────┬──────┘
       │
       │ 1. Request refund
       │    POST /payments/:id/refund
       │
       ▼
┌──────────────────────────────────────┐
│  Backend Validation                  │
│  - Payment status is SUCCESS?        │
│  - User authorized?                  │
│  - Amount valid?                     │
└──────┬───────────────────────────────┘
       │
       │ 2. Call Razorpay API
       │
       ▼
┌──────────────────────────────────────┐
│  Razorpay API                        │
│  payments.refund(payment_id, amount) │
└──────┬───────────────────────────────┘
       │
       │ 3. Refund processed
       │    Returns refund_id
       │
       ▼
┌──────────────────────────────────────┐
│  MongoDB Transaction                 │
│  - Update Payment → REFUNDED         │
│  - Create Transaction (REFUND)       │
│  - Debit Wallet balance              │
│  - Store refund metadata             │
└──────┬───────────────────────────────┘
       │
       │ 4. Send notification
       │
       ▼
┌──────────────────────────────────────┐
│  User                                │
│  "✅ Refund processed: ₹500"         │
└──────────────────────────────────────┘
```

---

## 🔐 Security Flow

```
┌──────────────────────────────────────┐
│  Payment Request                     │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Authentication                      │
│  - JWT token valid?                  │
│  - User role = MERCHANT/DISTRIBUTOR? │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Amount Validation                   │
│  - Min: ₹100                         │
│  - Max: ₹1,00,000 (configurable)     │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Signature Verification              │
│  - HMAC-SHA256                       │
│  - Timing-safe comparison            │
│  - Key: RAZORPAY_KEY_SECRET          │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Idempotency Check                   │
│  - Order ID unique?                  │
│  - Payment ID unique?                │
│  - Webhook event ID tracked?         │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Transaction                         │
│  - MongoDB session                   │
│  - ACID guarantees                   │
│  - Rollback on failure               │
└──────────────────────────────────────┘
```

---

## 📊 Status Transitions

```
PAYMENT STATUSES:

  ┌─────────┐
  │ PENDING │ ◄─── Order created
  └────┬────┘
       │
       ├──── Payment successful ────┐
       │                            ▼
       │                      ┌─────────┐
       │                      │ SUCCESS │
       │                      └────┬────┘
       │                           │
       │                           │ Refund requested
       │                           │
       │                           ▼
       │                      ┌──────────┐
       │                      │ REFUNDED │
       │                      └──────────┘
       │
       └──── Payment failed ────┐
                                ▼
                           ┌────────┐
                           │ FAILED │
                           └────────┘
```

---

## 🎯 Key Points

1. **Two verification paths:**
   - Frontend verification (user-initiated)
   - Webhook verification (Razorpay-initiated)

2. **Idempotency:**
   - Duplicate webhooks safely ignored
   - Duplicate verify requests handled

3. **Transaction safety:**
   - All wallet updates in MongoDB transactions
   - Automatic rollback on errors

4. **Security:**
   - Signature verification on both paths
   - Role-based access control
   - Amount validation

5. **Monitoring:**
   - All events logged
   - Audit trail maintained
   - Notifications sent

---

*Visual Reference for Vexaro Razorpay Integration*
