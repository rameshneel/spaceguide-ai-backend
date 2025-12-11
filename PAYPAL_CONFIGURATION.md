# PayPal Configuration - Complete Setup Guide

## ✅ Current Configuration Status

### Sandbox Credentials (From PayPal Dashboard):

- **Client ID:** `AdkEfLcidinEFonCDppoC40cI2dQlZ7vCJbiU_6ouf2B5jWSFc7hJhgwWriIKd-S2OM0hbxoaT588KQn`
- **Secret Key:** (Hidden - check PayPal dashboard)
- **Sandbox URL:** `https://sandbox.paypal.com`
- **Region:** US

### Webhook Configuration:

- **Webhook URL:** `https://dev-api.prelaunchserver.com/api/payment/paypal/webhook`
- **Webhook ID:** `5BR5360767972570E` ⚠️ **NEEDS TO BE SET IN ENV**
- **Events Configured:**
  - ✅ Billing subscription activated
  - ✅ Billing subscription cancelled
  - ✅ Billing subscription created
  - ✅ Billing subscription expired
  - ✅ Billing subscription payment failed
  - ✅ Billing subscription re-activated
  - ✅ Billing subscription suspended
  - ✅ Billing subscription updated

---

## 🔧 Environment Variables Setup

### Required Variables:

Add these to your `.env` file in `api-service` directory:

```bash
# PayPal Sandbox Credentials
PAYPAL_CLIENT_ID=AdkEfLcidinEFonCDppoC40cI2dQlZ7vCJbiU_6ouf2B5jWSFc7hJhgwWriIKd-S2OM0hbxoaT588KQn
PAYPAL_CLIENT_SECRET=your-secret-key-here  # Get from PayPal dashboard
PAYPAL_MODE=sandbox  # or 'live' for production
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com  # Sandbox URL

# PayPal Webhook Configuration
PAYPAL_WEBHOOK_ID=5BR5360767972570E  # ⚠️ IMPORTANT: Set this!

# Frontend URL (for return URLs)
FRONTEND_URL=https://your-frontend-domain.com
# Or for development:
# FRONTEND_URL=http://localhost:3000
```

---

## 📋 Setup Steps

### Step 1: Get Secret Key from PayPal

1. Go to PayPal Developer Dashboard
2. Select your app: **Ai -Project**
3. Click on **Secret key 1** → **Show**
4. Copy the secret key
5. Add to `.env` file as `PAYPAL_CLIENT_SECRET`

### Step 2: Set Webhook ID

1. Copy Webhook ID: `5BR5360767972570E`
2. Add to `.env` file as `PAYPAL_WEBHOOK_ID`

### Step 3: Verify Configuration

Check your `.env` file has all these:

```bash
✅ PAYPAL_CLIENT_ID=AdkEfLcidinEFonCDppoC40cI2dQlZ7vCJbiU_6ouf2B5jWSFc7hJhgwWriIKd-S2OM0hbxoaT588KQn
✅ PAYPAL_CLIENT_SECRET=your-secret-here
✅ PAYPAL_MODE=sandbox
✅ PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
✅ PAYPAL_WEBHOOK_ID=5BR5360767972570E
✅ FRONTEND_URL=https://your-frontend-domain.com
```

---

## 🧪 Testing Webhook

### Test 1: Send Test Event from PayPal Dashboard

1. Go to PayPal Dashboard → Webhooks
2. Click on your webhook
3. Click **"Send Test"**
4. Select event: **"Billing subscription activated"**
5. Check backend logs for:
   ```
   ✅ PayPal webhook received: BILLING.SUBSCRIPTION.ACTIVATED
   ✅ Processing PayPal test webhook event
   ✅ Webhook processed successfully
   ```

### Test 2: Real Payment Test

1. Make a test payment
2. Complete PayPal checkout
3. Check webhook receives event
4. Verify subscription activates
5. Check user subscription updated

---

## 🔍 Verification Checklist

- [ ] `PAYPAL_CLIENT_ID` set in `.env`
- [ ] `PAYPAL_CLIENT_SECRET` set in `.env`
- [ ] `PAYPAL_WEBHOOK_ID` set in `.env` ⚠️ **CRITICAL**
- [ ] `PAYPAL_MODE` set to `sandbox`
- [ ] `PAYPAL_BASE_URL` set correctly
- [ ] `FRONTEND_URL` set correctly
- [ ] Webhook URL accessible (not localhost)
- [ ] Backend running and receiving webhooks
- [ ] Test event sent successfully
- [ ] Real payment tested

---

## 🎯 Current Status

### ✅ Configured:

- Webhook URL registered in PayPal
- Events configured correctly
- Webhook handler implemented in backend
- Signature verification implemented

### ⚠️ Needs Setup:

- `PAYPAL_WEBHOOK_ID` environment variable
- `PAYPAL_CLIENT_SECRET` environment variable
- Test with real payment

---

## 📊 Webhook Events Configured

| Event                                 | Status | Purpose                      |
| ------------------------------------- | ------ | ---------------------------- |
| `BILLING.SUBSCRIPTION.ACTIVATED`      | ✅     | Activate subscription        |
| `BILLING.SUBSCRIPTION.CANCELLED`      | ✅     | Cancel subscription          |
| `BILLING.SUBSCRIPTION.CREATED`        | ✅     | Track new subscriptions      |
| `BILLING.SUBSCRIPTION.EXPIRED`        | ✅     | Handle expired subscriptions |
| `BILLING.SUBSCRIPTION.PAYMENT_FAILED` | ✅     | Handle failed payments       |
| `BILLING.SUBSCRIPTION.RE-ACTIVATED`   | ✅     | Reactivate subscription      |
| `BILLING.SUBSCRIPTION.SUSPENDED`      | ✅     | Suspend subscription         |
| `BILLING.SUBSCRIPTION.UPDATED`        | ✅     | Sync subscription changes    |

---

## 🚀 Next Steps

1. **Set Environment Variables**

   - Add `PAYPAL_WEBHOOK_ID=5BR5360767972570E`
   - Add `PAYPAL_CLIENT_SECRET` (from dashboard)

2. **Restart Backend**

   ```bash
   # Restart API server to load new env variables
   npm restart
   # or
   pm2 restart api-service
   ```

3. **Test Webhook**

   - Send test event from PayPal dashboard
   - Check backend logs
   - Verify response

4. **Test Real Payment**
   - Make test payment
   - Verify webhook receives event
   - Check subscription activates

---

## ⚠️ Important Notes

1. **Webhook ID is Critical**: Without `PAYPAL_WEBHOOK_ID`, signature verification will fail
2. **Sandbox vs Live**: Currently using sandbox - switch to live for production
3. **Secret Key Security**: Never commit secret keys to git
4. **Webhook URL**: Must be publicly accessible (HTTPS required)

---

## 🔐 Security Checklist

- [ ] `.env` file in `.gitignore`
- [ ] Secret keys not committed to git
- [ ] Webhook signature verification enabled
- [ ] HTTPS enabled for webhook URL
- [ ] Environment variables secured

---

## ✅ Summary

**Webhook Configuration:** ✅ Complete
**Backend Implementation:** ✅ Complete
**Environment Setup:** ⚠️ Needs `PAYPAL_WEBHOOK_ID`

**Action Required:**

1. Set `PAYPAL_WEBHOOK_ID=5BR5360767972570E` in `.env`
2. Set `PAYPAL_CLIENT_SECRET` in `.env`
3. Restart backend
4. Test webhook

---

**Once environment variables are set, webhooks will work perfectly!** 🎉
