# Razorpay Testing Guide

Quick reference for testing Razorpay integration in Vexaro Backend.

---

## 🔧 Setup Test Environment

### 1. Get Test Credentials
Visit [Razorpay Dashboard](https://dashboard.razorpay.com/test/dashboard) and copy:
- **Key ID:** `rzp_test_XXXXXXXX`
- **Key Secret:** `YYYYYYYY`

### 2. Update .env
```env
RAZORPAY_KEY_ID=rzp_test_XXXXXXXX
RAZORPAY_KEY_SECRET=YYYYYYYY
RAZORPAY_WEBHOOK_SECRET=test_webhook_secret
RAZORPAY_MAX_TOPUP_AMOUNT=100000
```

### 3. Start Backend
```bash
npm run dev
```

---

## 🧪 Test Scenarios

### Scenario 1: Successful Payment (UPI)

**Step 1:** Create Order
```bash
curl -X POST http://localhost:5000/api/v1/wallet/razorpay/create-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 500}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Razorpay order created",
  "data": {
    "razorpayOrderId": "order_...",
    "keyId": "rzp_test_...",
    "amount": 50000
  }
}
```

**Step 2:** Open Razorpay Checkout
- Use the HTML example file
- Enter amount: 500
- Select UPI
- Use test UPI ID: `success@razorpay`

**Step 3:** Verify Payment
(Automatically called by frontend after successful payment)

---

### Scenario 2: Failed Payment

**Test with:**
- UPI ID: `failure@razorpay`
- Any card ending in 0002

**Expected Behavior:**
- Payment status: FAILED
- Error message stored in `failureReason`
- No wallet credit

**Verify:**
```bash
curl -X GET http://localhost:5000/api/v1/finance/payments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Scenario 3: Payment Refund

**Step 1:** Complete a successful payment (Scenario 1)

**Step 2:** Get Payment ID from response

**Step 3:** Request Refund
```bash
curl -X POST http://localhost:5000/api/v1/finance/payments/PAYMENT_ID/refund \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 250,
    "reason": "Testing refund flow"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Payment refunded successfully",
  "data": {
    "refund": {
      "id": "rfnd_...",
      "amount": 25000,
      "status": "processed"
    },
    "wallet": {
      "balance": 250
    }
  }
}
```

---

### Scenario 4: Webhook Testing

**Option A: Use Razorpay Dashboard**
1. Go to Settings → Webhooks
2. Click "Test Webhook"
3. Select event: `payment.captured`
4. Click "Send Test"

**Option B: Manual cURL**
```bash
# Generate signature (use Node.js)
node -e "
const crypto = require('crypto');
const secret = 'test_webhook_secret';
const payload = JSON.stringify({
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: 'pay_test123',
        order_id: 'order_test456',
        amount: 50000,
        status: 'captured',
        captured: true
      }
    }
  }
});
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log(signature);
"
```

```bash
curl -X POST http://localhost:5000/api/webhooks/razorpay \
  -H "X-Razorpay-Signature: GENERATED_SIGNATURE" \
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

## 💳 Test Payment Methods

### UPI
| VPA | Result |
|-----|--------|
| `success@razorpay` | Success |
| `failure@razorpay` | Failure |

### Cards
| Card Number | CVV | Expiry | Result |
|-------------|-----|--------|--------|
| 4111 1111 1111 1111 | 123 | Any future | Success |
| 4012 0010 0000 0001 | 123 | Any future | Success |
| 4000 0000 0000 0002 | 123 | Any future | Failure |
| 5104 0600 0000 0008 | 123 | Any future | Success (Mastercard) |

### NetBanking
- Select any bank → Success
- Test Bank → Use for testing

### Wallets
- Amazon Pay
- PhonePe
- Google Pay

---

## ✅ Validation Checklist

### Payment Creation
- [ ] Amount validation (min ₹100, max ₹100000)
- [ ] Role check (MERCHANT/DISTRIBUTOR only)
- [ ] Wallet existence check
- [ ] Wallet active status check
- [ ] Order created in Razorpay
- [ ] Payment record created in DB

### Payment Verification
- [ ] Signature validation succeeds
- [ ] Amount matches order
- [ ] Currency matches (INR)
- [ ] Payment status is 'captured'
- [ ] Wallet credited atomically
- [ ] Transaction record created
- [ ] Notification sent to user
- [ ] Idempotency works (duplicate requests)


### Webhook Processing
- [ ] Signature validation works
- [ ] Payment captured event processed
- [ ] Payment failed event processed
- [ ] Wallet credited via webhook
- [ ] Duplicate webhooks ignored
- [ ] Event IDs tracked
- [ ] Invalid signatures rejected

### Refund Flow
- [ ] Only successful payments refundable
- [ ] Partial refund works
- [ ] Full refund works
- [ ] Wallet debited correctly
- [ ] Refund transaction created
- [ ] Notification sent
- [ ] Payment status updated to REFUNDED

---

## 🐛 Common Issues & Fixes

### Issue 1: "Razorpay is not configured"
**Solution:** Check `.env` file has `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`

### Issue 2: "Invalid webhook signature"
**Solution:** 
- Verify `RAZORPAY_WEBHOOK_SECRET` matches Razorpay dashboard
- Check raw body parser is enabled for webhook route

### Issue 3: "Payment already being processed"
**Solution:** This is normal for concurrent requests. Wait for first request to complete.

### Issue 4: Transaction fails with "replica set error"
**Solution:** 
- Start MongoDB with replica set: `mongod --replSet rs0`
- Initialize: `rs.initiate()` in mongo shell

### Issue 5: Wallet not credited after payment
**Check:**
1. Payment status in DB (should be SUCCESS)
2. Transaction record exists
3. Webhook received (check logs)
4. No errors in logs

---

## 📊 Monitoring

### Check Payment Status
```bash
curl -X GET "http://localhost:5000/api/v1/finance/payments?status=SUCCESS" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Check Wallet Balance
```bash
curl -X GET http://localhost:5000/api/v1/finance/wallet \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Check Transaction History
```bash
curl -X GET "http://localhost:5000/api/v1/finance/transactions?limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

**Happy Testing! 🚀**
