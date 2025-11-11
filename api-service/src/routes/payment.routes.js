import express from "express";
import {
  createStripeCustomer,
  createPaymentIntentController,
  confirmPaymentController,
  createStripeSubscription,
  handleStripeWebhook,
  getPaymentMethods,
  cancelStripeSubscription,
  checkPaymentStatus,
  retryPayment,
} from "../controllers/payment.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { validateSubscriptionUpgrade } from "../validation/subscription.validation.js";

const router = express.Router();

// ========================================
// PAYMENT MANAGEMENT ROUTES
// ========================================

// Create Stripe customer
router.post("/customer/create", verifyJWT, createStripeCustomer);
// Create Payment Intent (for one-time payment)
router.post("/create-intent", verifyJWT, createPaymentIntentController);
// Confirm Payment Intent
router.post("/confirm", verifyJWT, confirmPaymentController);
// Create Stripe subscription
router.post(
  "/subscription/create",
  verifyJWT,
  validateSubscriptionUpgrade,
  createStripeSubscription
);

// Get payment methods
router.get("/methods", verifyJWT, getPaymentMethods);

// Check payment status
router.get("/status/:paymentIntentId", verifyJWT, checkPaymentStatus);

// Retry payment (for failed/canceled payments)
router.post("/retry", verifyJWT, retryPayment);

// Cancel Stripe subscription
router.post("/subscription/cancel", verifyJWT, cancelStripeSubscription);

// ========================================
// STRIPE WEBHOOK ROUTES
// ========================================

// Handle Stripe webhooks (no auth required - uses signature verification)
router.post("/webhook", handleStripeWebhook);

export default router;
