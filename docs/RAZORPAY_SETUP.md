# 🚀 Razorpay Setup Guide for Vexaro

**5-Minute Setup** | Complete guide to get Razorpay payments working

---

## ⚡ Quick Setup (3 Steps)

### Step 1: Get Razorpay Credentials (2 minutes)

1. **Sign up:** Visit [https://dashboard.razorpay.com](https://dashboard.razorpay.com)
2. **Verify email** and complete KYC (for live mode)
3. **Get API Keys:**
   - Go to **Settings** → **API Keys**
   - Click **Generate Test Keys** (for development)
   - Copy **Key ID** and **Key Secret**

### Step 2: Update Environment Variables (1 minute)

Open `.env` file and add:
```env
RAZORPAY_KEY_ID=rzp_test_your_key_id_here
RAZORPAY_KEY_SECRET=your_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
RAZORPAY_MAX_TOPUP_AMOUNT=100000
```

### Step 3: Configure Webhook (2 minutes)

1. Go to **Settings** → **Webhooks** in Razorpay Dashboard
2. Click **Create New Webhook**
3. Enter details:
   ```
   Webhook URL: https://yourdomain.com/api/webhooks/razorpay
   ```
4. Select events:
   - ☑️ `payment.captured`
   - ☑️ `payment.failed`
   - ☑️ `order.paid`
   - ☑️ `refund.processed`
5. Click **Create**
6. Copy the **Webhook Secret** to your `.env` file

**Done! Your backend is ready to accept payments.** ✅

---

## 🧪 Test Your Setup

### 1. Start Backend
```bash
npm run dev
```

### 2. Test API Endpoint
```bash
curl http://localhost:5000/health
```

Expected: Status `200 OK`

### 3. Create Test Payment
```bash
curl -X POST http://localhost:5000/api/v1/wallet/razorpay/create-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 500}'
```

Expected response:
```json
{
  "success": true,
  "message": "Razorpay order created",
  "data": {
    "razorpayOrderId": "order_...",
    "amount": 50000,
    "keyId": "rzp_test_..."
  }
}
```

---

## 🎨 Frontend Integration

### Option 1: HTML/JavaScript (Quickest)

Use the provided `RAZORPAY_FRONTEND_EXAMPLE.html`:

1. Open the file
2. Update line with JWT token:
   ```javascript
   const JWT_TOKEN = 'your_actual_jwt_token_here';
   ```
3. Open in browser
4. Enter amount and click payment

### Option 2: React

```bash
npm install react-razorpay
```

```jsx
import useRazorpay from "react-razorpay";

function WalletTopup() {
  const Razorpay = useRazorpay();

  const handlePayment = async (amount) => {
    // Create order
    const order = await fetch('/api/v1/wallet/razorpay/create-order', {
      method: 'POST',
      headers: { 
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount })
    }).then(r => r.json());

    // Open Razorpay
    const options = {
      key: order.data.keyId,
      amount: order.data.amount,
      order_id: order.data.razorpayOrderId,
      name: "Vexaro",
      handler: async (response) => {
        // Verify payment
        await fetch('/api/v1/wallet/razorpay/verify', {
          method: 'POST',
          headers: { 
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(response)
        });
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  };

  return <button onClick={() => handlePayment(500)}>Add ₹500</button>;
}
```


### Option 3: Angular

```typescript
// razorpay.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

declare var Razorpay: any;

@Injectable({ providedIn: 'root' })
export class RazorpayService {
  constructor(private http: HttpClient) {}

  async initiatePayment(amount: number) {
    // Create order
    const order: any = await this.http
      .post('/api/v1/wallet/razorpay/create-order', { amount })
      .toPromise();

    // Open Razorpay
    const options = {
      key: order.data.keyId,
      amount: order.data.amount,
      order_id: order.data.razorpayOrderId,
      name: 'Vexaro',
      handler: (response: any) => this.verifyPayment(response)
    };

    const rzp = new Razorpay(options);
    rzp.open();
  }

  async verifyPayment(response: any) {
    return this.http
      .post('/api/v1/wallet/razorpay/verify', response)
      .toPromise();
  }
}
```

Add to `index.html`:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

---

## 💳 Test Payment Methods

### UPI (Easiest)
| VPA | Result |
|-----|--------|
| `success@razorpay` | ✅ Success |
| `failure@razorpay` | ❌ Failure |

### Credit/Debit Cards
| Card Number | Result |
|-------------|--------|
| 4111 1111 1111 1111 | ✅ Success |
| 4000 0000 0000 0002 | ❌ Failure |

**CVV:** Any 3 digits  
**Expiry:** Any future date  
**Name:** Any name

### NetBanking
Select any bank → Success

---

## 🔍 Troubleshooting

### ❌ "Razorpay is not configured"
**Problem:** Environment variables not loaded  
**Solution:** 
1. Check `.env` file exists
2. Restart server: `npm run dev`
3. Verify `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set

### ❌ "Invalid webhook signature"
**Problem:** Webhook secret mismatch  
**Solution:**
1. Copy webhook secret from Razorpay dashboard
2. Update `RAZORPAY_WEBHOOK_SECRET` in `.env`
3. Restart server

### ❌ "Only Merchants and Distributors can add money"
**Problem:** User role incorrect  
**Solution:** Login with MERCHANT or DISTRIBUTOR account

### ❌ "Payment already being processed"
**Problem:** Duplicate request  
**Solution:** This is normal. Wait for first request to complete.

### ❌ Webhook not receiving events
**Problem:** Webhook URL incorrect or unreachable  
**Solution:**
1. Verify URL in Razorpay dashboard is correct
2. Use ngrok for local testing: `ngrok http 5000`
3. Update webhook URL to: `https://your-ngrok-url.ngrok.io/api/webhooks/razorpay`

---

## 🚀 Go Live Checklist

When moving to production:

### 1. Switch to Live Keys
```env
RAZORPAY_KEY_ID=rzp_live_XXXXXXXX
RAZORPAY_KEY_SECRET=live_secret_XXXXXXXX
```

### 2. Update Webhook URL
```
https://yourdomain.com/api/webhooks/razorpay
```

### 3. Complete KYC
- Submit business documents
- Verify bank account
- Enable settlements

### 4. Security
- [ ] Enable HTTPS
- [ ] Set strong webhook secret
- [ ] Enable IP whitelisting
- [ ] Configure rate limiting
- [ ] Enable 2FA on Razorpay account

### 5. Monitoring
- [ ] Set up payment alerts
- [ ] Enable Sentry error tracking
- [ ] Configure daily reconciliation
- [ ] Review settlement reports

---

## 📊 Features Available

### For Users (Merchants/Distributors)
✅ Add money via UPI, Cards, NetBanking, Wallets  
✅ Instant wallet credit  
✅ Transaction history  
✅ Payment receipts  
✅ Refund support  

### For Admins (Super Admin)
✅ View all payments  
✅ Process refunds  
✅ Payment analytics  
✅ Audit logs  
✅ Reconciliation reports  

---

## 📚 Documentation

- **Complete API Docs:** See `RAZORPAY_INTEGRATION.md`
- **Testing Guide:** See `RAZORPAY_TESTING_GUIDE.md`
- **Frontend Example:** See `RAZORPAY_FRONTEND_EXAMPLE.html`
- **Summary:** See `RAZORPAY_SUMMARY.md`

---

## 🎉 You're All Set!

Your Razorpay integration is complete and ready to use. Just:
1. ✅ Add credentials to `.env`
2. ✅ Setup webhook
3. ✅ Build frontend UI
4. ✅ Test and deploy

**Need help?** Check the docs or contact Razorpay support.

---

*Last Updated: July 3, 2026*  
*Version: 1.0.0*
