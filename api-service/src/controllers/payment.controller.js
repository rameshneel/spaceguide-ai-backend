import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Stripe from "stripe";
import {
  createCustomer,
  createPaymentIntent,
  createSubscription,
  handleWebhook,
} from "../services/payment/stripe.js";
import {
  createPayPalSubscriptionSession,
  getPayPalSubscriptionDetails,
  activatePayPalSubscription,
  cancelPayPalSubscription as cancelPaypalSubscriptionService,
  verifyPayPalWebhookSignature,
  applyPlanToUserSubscription,
} from "../services/payment/paypal.js";
import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";
import User from "../models/user.model.js";
import Payment from "../models/payment.model.js";
import { safeLogger as logger } from "../utils/logger.js";
import { calculatePeriodEnd } from "../utils/subscriptionUtils.js";

// Create Stripe customer
export const createStripeCustomer = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  try {
    const customer = await createCustomer({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      id: userId,
    });

    // Update user with Stripe customer ID
    user.stripeCustomerId = customer.id;
    await user.save();

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          customerId: customer.id,
          email: customer.email,
        },
        "Stripe customer created successfully"
      )
    );
  } catch (error) {
    throw new ApiError(
      500,
      `Failed to create Stripe customer: ${error.message}`
    );
  }
});

// Create Payment Intent for subscription upgrade
export const createPaymentIntentController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { planId, billingCycle = "monthly" } = req.body;

  if (!planId) {
    throw new ApiError(400, "Plan ID is required");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Try to find plan by ID first, if that fails, try by type
  let plan = null;
  const mongoose = (await import("mongoose")).default;

  // Check if planId is a valid MongoDB ObjectId
  if (mongoose.Types.ObjectId.isValid(planId)) {
    plan = await SubscriptionPlan.findById(planId);
  }

  // If not found by ID, try to find by type (e.g., "basic", "pro", etc.)
  if (!plan) {
    plan = await SubscriptionPlan.findOne({
      type: planId,
      status: "active",
    });
  }

  if (!plan) {
    throw new ApiError(404, `Subscription plan not found: ${planId}`);
  }

  if (plan.type === "free") {
    throw new ApiError(400, "Cannot create payment intent for free plan");
  }

  // Get or create Stripe customer
  let customerId = user.stripeCustomerId;
  let customer = null;

  if (!customerId) {
    // Create new customer with address for Indian regulations
    customer = await createCustomer({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      id: userId,
      // Address can be added here if available in user model
      // For now, default address will be used (see createCustomer function)
    });
    customerId = customer.id;
    user.stripeCustomerId = customerId;
    await user.save();
  } else {
    // If customer exists, retrieve it to get address
    try {
      const Stripe = (await import("stripe")).default;
      const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
      customer = await stripeClient.customers.retrieve(customerId);

      // If customer doesn't have address, update it (required for Indian regulations)
      if (!customer.address || !customer.address.country) {
        customer = await stripeClient.customers.update(customerId, {
          address: {
            line1: "Not provided",
            city: "Not provided",
            postal_code: "000000",
            country: "US", // Default country code (ISO-3166)
          },
        });
      }
    } catch (error) {
      logger.warn("Failed to retrieve/update customer address:", error);
    }
  }

  // Get user's current subscription to store previous plan info
  const currentSubscription = await Subscription.findOne({ userId });
  const previousPlanId = currentSubscription?.planId?.toString() || null;
  const previousPlanType = currentSubscription?.plan || "free";

  // Calculate amount based on billing cycle
  const amount =
    billingCycle === "yearly" ? plan.price.yearly : plan.price.monthly;
  const currency = plan.price.currency || "usd";

  // Log plan details for debugging
  logger.debug("Payment Intent - Plan Details:", {
    planId: plan._id,
    planType: plan.type,
    planName: plan.name,
    monthlyPrice: plan.price.monthly,
    yearlyPrice: plan.price.yearly,
    calculatedAmount: amount,
    billingCycle,
    previousPlanId,
    previousPlanType,
  });

  try {
    // Create description for PaymentIntent (required for Indian Stripe accounts)
    const description = `Subscription upgrade to ${
      plan.displayName || plan.name
    } Plan (${billingCycle})`;

    // Create PaymentIntent
    // Note: Customer address is already set on customer object (required for Indian regulations)
    // Stripe automatically uses the customer's address for billing
    const paymentIntent = await createPaymentIntent(
      customerId,
      amount,
      currency,
      {
        userId: userId.toString(),
        planId: plan._id.toString(), // Store actual MongoDB ID
        planType: plan.type, // Also store plan type for reference
        originalPlanId: planId.toString(), // Store original input (might be type string)
        billingCycle: billingCycle,
        previousPlanId: previousPlanId || "", // Store previous plan ID for rollback
        previousPlanType: previousPlanType, // Store previous plan type for rollback
      },
      description // Pass description for Indian regulations (required for export transactions)
    );

    // Create Payment record with "pending" status for tracking
    // This helps track incomplete/abandoned payments
    const payment = new Payment({
      userId: user._id,
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toUpperCase(),
      status: "pending", // Initial status - will be updated via webhook
      stripe: {
        paymentIntentId: paymentIntent.id,
        customerId: customerId,
      },
      subscription: {
        plan: billingCycle === "yearly" ? "yearly" : "monthly",
      },
      metadata: {
        source: "payment_intent",
      },
    });
    await payment.save();

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          amount: amount,
          currency: currency,
          planId: plan._id.toString(), // Return actual MongoDB ID
          planType: plan.type, // Also return plan type for reference
          billingCycle: billingCycle,
          paymentId: payment._id.toString(), // Return Payment record ID for tracking
        },
        "Payment intent created successfully"
      )
    );
  } catch (error) {
    throw new ApiError(
      500,
      `Failed to create payment intent: ${error.message}`
    );
  }
});

// Confirm Payment Intent (verify payment succeeded)
export const confirmPaymentController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { paymentIntentId, planId } = req.body;

  if (!paymentIntentId) {
    throw new ApiError(400, "Payment Intent ID is required");
  }

  if (!planId) {
    throw new ApiError(400, "Plan ID is required");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Try to find plan by ID first, if that fails, try by type
  let plan = null;
  const mongoose = (await import("mongoose")).default;

  // Check if planId is a valid MongoDB ObjectId
  if (mongoose.Types.ObjectId.isValid(planId)) {
    plan = await SubscriptionPlan.findById(planId);
  }

  // If not found by ID, try to find by type (e.g., "basic", "pro", etc.)
  if (!plan) {
    plan = await SubscriptionPlan.findOne({
      type: planId,
      status: "active",
    });
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripeClient.paymentIntents.retrieve(
      paymentIntentId
    );

    // Get customer ID from payment intent (it's always there)
    const customerIdFromPaymentIntent = paymentIntent.customer;

    // If user doesn't have stripeCustomerId, update it from payment intent
    if (!user.stripeCustomerId) {
      user.stripeCustomerId = customerIdFromPaymentIntent;
      await user.save();
    }

    // Verify payment intent belongs to user
    if (paymentIntent.customer !== user.stripeCustomerId) {
      throw new ApiError(403, "Payment intent does not belong to this user");
    }

    // Verify payment succeeded
    if (paymentIntent.status !== "succeeded") {
      throw new ApiError(
        400,
        `Payment not completed. Status: ${paymentIntent.status}`
      );
    }

    // Verify plan ID matches (check both planId and planType in metadata)
    const metadataPlanId = paymentIntent.metadata.planId;
    const metadataPlanType = paymentIntent.metadata.planType;
    const metadataOriginalPlanId = paymentIntent.metadata.originalPlanId;

    // Check if planId matches directly, or if it's a type that matches metadataPlanType
    // Also check if we found a plan and it matches the metadata
    let planMatches = false;

    if (plan) {
      // If we found a plan, check if it matches the metadata
      planMatches =
        metadataPlanId === plan._id.toString() ||
        metadataPlanType === plan.type ||
        metadataPlanId === planId.toString() ||
        metadataPlanType === planId.toString() ||
        metadataOriginalPlanId === planId.toString();
    } else {
      // If no plan found, just check metadata
      planMatches =
        metadataPlanId === planId.toString() ||
        metadataPlanType === planId.toString() ||
        metadataOriginalPlanId === planId.toString();
    }

    if (!planMatches) {
      throw new ApiError(400, "Plan ID mismatch");
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount / 100, // Convert from cents
          currency: paymentIntent.currency,
          planId: plan ? plan._id.toString() : metadataPlanId, // Return actual MongoDB ID if plan found
          planType: plan ? plan.type : metadataPlanType, // Return plan type
        },
        "Payment confirmed successfully"
      )
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Failed to confirm payment: ${error.message}`);
  }
});

// Create Stripe subscription
export const createStripeSubscription = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { planId, billingCycle = "monthly" } = req.body;

  if (!planId) {
    throw new ApiError(400, "Plan ID is required");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Try to find plan by ID first, if that fails, try by type
  let plan = null;
  const mongoose = (await import("mongoose")).default;

  // Check if planId is a valid MongoDB ObjectId
  if (mongoose.Types.ObjectId.isValid(planId)) {
    plan = await SubscriptionPlan.findById(planId);
  }

  // If not found by ID, try to find by type (e.g., "basic", "pro", etc.)
  if (!plan) {
    plan = await SubscriptionPlan.findOne({
      type: planId,
      status: "active",
    });
  }

  if (!plan) {
    throw new ApiError(404, `Subscription plan not found: ${planId}`);
  }

  if (plan.type === "free") {
    throw new ApiError(400, "Cannot create Stripe subscription for free plan");
  }

  // Get or create Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await createCustomer({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      id: userId,
    });
    customerId = customer.id;
    user.stripeCustomerId = customerId;
    await user.save();
  }

  // Get Stripe price ID based on billing cycle
  const priceId =
    billingCycle === "yearly"
      ? plan.stripe.priceIdYearly
      : plan.stripe.priceIdMonthly;

  if (!priceId) {
    throw new ApiError(
      400,
      `Stripe price ID not configured for ${billingCycle} billing`
    );
  }

  try {
    const subscription = await createSubscription(customerId, priceId);

    // Create subscription record in database
    const subscriptionData = {
      userId: userId,
      planId: plan._id,
      plan: plan.type,
      status: "pending", // Will be updated via webhook
      billingCycle: billingCycle,
      amount:
        billingCycle === "yearly" ? plan.price.yearly : plan.price.monthly,
      currency: plan.price.currency,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      stripePriceId: priceId,
      limits: plan.features,
      features: plan.features,
      usage: {
        wordsUsed: 0,
        imagesUsed: 0,
        minutesUsed: 0,
        charactersUsed: 0,
        pagesUsed: 0,
        chatbotsUsed: 0,
        voiceClonesUsed: 0,
        lastResetDate: new Date(),
      },
    };

    const newSubscription = new Subscription(subscriptionData);
    await newSubscription.save();

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          subscriptionId: subscription.id,
          clientSecret:
            subscription.latest_invoice.payment_intent.client_secret,
          status: subscription.status,
          plan: plan.type,
          amount: subscriptionData.amount,
          currency: subscriptionData.currency,
        },
        "Stripe subscription created successfully"
      )
    );
  } catch (error) {
    throw new ApiError(
      500,
      `Failed to create Stripe subscription: ${error.message}`
    );
  }
});

// ========================================
// PAYPAL SUBSCRIPTION CONTROLLERS
// ========================================

// Create PayPal subscription session
export const createPayPalSubscription = asyncHandler(async (req, res) => {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    throw new ApiError(
      500,
      "PayPal is not configured. Please contact support."
    );
  }

  const userId = req.user._id;
  const { planId, billingCycle = "monthly" } = req.body;

  if (!planId) {
    throw new ApiError(400, "Plan ID is required");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  let plan = null;
  const mongoose = (await import("mongoose")).default;
  if (mongoose.Types.ObjectId.isValid(planId)) {
    plan = await SubscriptionPlan.findById(planId);
  }
  if (!plan) {
    plan = await SubscriptionPlan.findOne({
      type: planId,
      status: "active",
    });
  }

  if (!plan) {
    throw new ApiError(404, `Subscription plan not found: ${planId}`);
  }

  if (plan.type === "free") {
    throw new ApiError(400, "Cannot create PayPal subscription for free plan");
  }

  const amount =
    billingCycle === "yearly" ? plan.price.yearly : plan.price.monthly;
  const currency = (plan.price.currency || "USD").toUpperCase();

  try {
    logger.debug("Creating PayPal subscription:", {
      userId: user._id,
      planId: plan._id,
      planName: plan.name,
      billingCycle,
      amount,
      currency,
    });

    // Use SDK flow (popup) instead of redirect flow
    // This allows PayPal SDK to handle approval internally
    const session = await createPayPalSubscriptionSession({
      user,
      plan,
      billingCycle,
      useSDKFlow: true, // Enable SDK flow for popup approval
    });

    logger.info("PayPal subscription session created:", {
      subscriptionId: session.subscriptionId,
      status: session.status,
      hasApprovalUrl: !!session.approvalUrl,
    });

    const paymentRecord = new Payment({
      userId: user._id,
      amount: Math.round((amount || 0) * 100),
      currency,
      status: "pending",
      paypal: {
        subscriptionId: session.subscriptionId,
        planId: session.planId,
        approvalUrl: session.approvalUrl,
      },
      subscription: {
        plan: billingCycle,
        autoRenew: true,
      },
      metadata: {
        source: "paypal_subscription",
        planId: plan._id.toString(),
        billingCycle,
      },
    });
    await paymentRecord.save();

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          subscriptionId: session.subscriptionId,
          approvalUrl: session.approvalUrl,
          status: session.status,
        },
        "PayPal subscription created successfully"
      )
    );
  } catch (error) {
    logger.error("PayPal subscription creation failed:", {
      error: error.message,
      stack: error.stack,
      userId: user._id,
      planId: plan._id,
      planName: plan.name,
      billingCycle,
      response: error.response?.data,
      body: error.body,
    });

    // Extract detailed error message
    const errorMessage =
      error?.message || "Failed to create PayPal subscription";

    throw new ApiError(
      500,
      errorMessage.includes("PayPal")
        ? errorMessage
        : `PayPal error: ${errorMessage}`
    );
  }
});

// Approve PayPal subscription after user completes approval flow
export const approvePayPalSubscription = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { subscriptionId } = req.body;

  // Input validation
  if (!subscriptionId) {
    throw new ApiError(400, "PayPal subscription ID is required");
  }

  // Validate subscription ID format (should start with "I-")
  if (
    typeof subscriptionId !== "string" ||
    subscriptionId.trim().length === 0
  ) {
    throw new ApiError(400, "Invalid subscription ID format");
  }

  const trimmedSubscriptionId = subscriptionId.trim();

  // Security: Basic format validation
  if (
    !trimmedSubscriptionId.startsWith("I-") &&
    trimmedSubscriptionId.length < 10
  ) {
    logger.warn("Suspicious subscription ID format:", {
      subscriptionId: trimmedSubscriptionId,
      userId,
      length: trimmedSubscriptionId.length,
    });
    // Still try to process, but log warning
  }

  let subscriptionDetails;
  try {
    subscriptionDetails = await getPayPalSubscriptionDetails(
      trimmedSubscriptionId
    );
  } catch (error) {
    // Error already logged in getPayPalSubscriptionDetails with details
    const errorMessage = error.message || "Unknown error";
    const statusCode = error.originalError?.response?.status || 500;

    logger.error("Error fetching PayPal subscription details:", {
      subscriptionId: trimmedSubscriptionId,
      errorMessage,
      statusCode,
      errorDetails: error.details,
      originalError: error.originalError?.message,
    });

    throw new ApiError(
      statusCode >= 400 && statusCode < 500 ? statusCode : 500,
      `Failed to fetch PayPal subscription details: ${errorMessage}`
    );
  }

  // Log subscription details for debugging
  logger.debug("PayPal subscription details:", {
    subscriptionId,
    status: subscriptionDetails.status,
    planId: subscriptionDetails.plan_id,
    hasStatus: subscriptionDetails.status !== undefined,
    allKeys: Object.keys(subscriptionDetails || {}),
  });

  // Check if subscription needs activation
  let subscriptionStatus = subscriptionDetails.status;

  if (subscriptionStatus === "APPROVED") {
    try {
      await activatePayPalSubscription(
        trimmedSubscriptionId,
        "User approved payment"
      );
      subscriptionDetails = await getPayPalSubscriptionDetails(
        trimmedSubscriptionId
      );
      // Update status after activation
      subscriptionStatus = subscriptionDetails.status;
    } catch (error) {
      logger.error("Error activating PayPal subscription:", {
        subscriptionId,
        error: error.message,
        stack: error.stack,
      });
      throw new ApiError(
        500,
        `Failed to activate PayPal subscription: ${
          error.message || "Unknown error"
        }`
      );
    }
  }

  // If status is undefined or not active, check if webhook already processed it
  if (
    !subscriptionStatus ||
    !["ACTIVE", "APPROVED"].includes(subscriptionStatus)
  ) {
    // Check if subscription already exists in our database (webhook might have processed it)
    const existingSubscription = await Subscription.findOne({
      paypalSubscriptionId: trimmedSubscriptionId,
      userId: userId,
    });

    if (existingSubscription && existingSubscription.status === "active") {
      logger.info(
        "Subscription already active via webhook, skipping approval:",
        {
          subscriptionId,
          userId,
        }
      );

      // Return success even though PayPal status might be undefined
      // Webhook has already activated it
      const plan = await SubscriptionPlan.findById(existingSubscription.planId);
      if (!plan) {
        throw new ApiError(404, "Plan not found for existing subscription");
      }

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            subscription: {
              id: existingSubscription._id,
              plan: existingSubscription.plan,
              billingCycle: existingSubscription.billingCycle,
              status: existingSubscription.status,
              currentPeriodStart: existingSubscription.currentPeriodStart,
              currentPeriodEnd: existingSubscription.currentPeriodEnd,
            },
            paypal: {
              subscriptionId,
              status: subscriptionStatus || "ACTIVE",
            },
            message: "Subscription already activated via webhook",
          },
          "PayPal subscription already activated"
        )
      );
    }

    // If not active and not in database, wait a bit for webhook to process
    // Webhooks usually process within 5-10 seconds
    logger.info(
      "Subscription status undefined, waiting for webhook to process:",
      {
        subscriptionId: trimmedSubscriptionId,
        userId,
        status: subscriptionStatus,
      }
    );

    // Wait 3 seconds and check database again (webhooks usually process within 5-10 seconds)
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check database again after waiting
    const retrySubscription = await Subscription.findOne({
      paypalSubscriptionId: trimmedSubscriptionId,
      userId: userId,
    });

    if (retrySubscription && retrySubscription.status === "active") {
      logger.info(
        "Subscription activated via webhook after wait, returning success:",
        {
          subscriptionId: trimmedSubscriptionId,
          userId,
        }
      );

      const plan = await SubscriptionPlan.findById(retrySubscription.planId);
      if (!plan) {
        throw new ApiError(404, "Plan not found for existing subscription");
      }

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            subscription: {
              id: retrySubscription._id,
              plan: retrySubscription.plan,
              billingCycle: retrySubscription.billingCycle,
              status: retrySubscription.status,
              currentPeriodStart: retrySubscription.currentPeriodStart,
              currentPeriodEnd: retrySubscription.currentPeriodEnd,
            },
            paypal: {
              subscriptionId: trimmedSubscriptionId,
              status: "ACTIVE",
            },
            message: "Subscription activated via webhook",
          },
          "PayPal subscription activated successfully"
        )
      );
    }

    // If still not active, throw error but with user-friendly optimistic message
    // Don't show technical details to user
    throw new ApiError(
      202, // 202 Accepted - request is being processed
      `Your payment was successful! Your subscription is being activated and will be ready in a few moments. You can refresh the page to see your updated subscription status.`
    );
  }

  const paypalPlanId = subscriptionDetails.plan_id;
  const plan = await SubscriptionPlan.findOne({
    $or: [
      { "paypal.planIdMonthly": paypalPlanId },
      { "paypal.planIdYearly": paypalPlanId },
    ],
  });

  if (!plan) {
    throw new ApiError(
      404,
      "Matching plan for PayPal subscription was not found"
    );
  }

  const billingCycle =
    plan.paypal?.planIdYearly === paypalPlanId ? "yearly" : "monthly";
  const amount =
    billingCycle === "yearly" ? plan.price.yearly : plan.price.monthly;
  const currency = (plan.price.currency || "USD").toUpperCase();

  const paymentRecord = await Payment.findOne({
    userId,
    "paypal.subscriptionId": trimmedSubscriptionId,
  }).sort({ createdAt: -1 });

  if (paymentRecord) {
    paymentRecord.status = "completed";
    paymentRecord.paypal = paymentRecord.paypal || {};
    paymentRecord.paypal.payerId =
      subscriptionDetails.subscriber?.payer_id || paymentRecord.paypal.payerId;
    paymentRecord.subscription = paymentRecord.subscription || {};
    paymentRecord.subscription.plan = billingCycle;
    paymentRecord.subscription.startDate = new Date();
    paymentRecord.subscription.endDate = calculatePeriodEnd(billingCycle);
    await paymentRecord.save();
  }

  const subscription = await applyPlanToUserSubscription({
    userId,
    plan,
    billingCycle,
    amount,
    currency,
    provider: "paypal",
    paypalInfo: {
      subscriptionId: trimmedSubscriptionId,
      planId: paypalPlanId,
      approvalUrl: paymentRecord?.paypal?.approvalUrl,
    },
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        subscription: {
          id: subscription._id,
          plan: subscription.plan,
          billingCycle: subscription.billingCycle,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
        paypal: {
          subscriptionId: trimmedSubscriptionId,
          status: subscriptionDetails.status,
        },
      },
      "PayPal subscription activated successfully"
    )
  );
});

// Cancel PayPal subscription
export const cancelPayPalSubscription = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { reason = "User requested cancellation" } = req.body;

  const subscription = await Subscription.findOne({ userId });

  if (
    !subscription ||
    subscription.provider !== "paypal" ||
    !subscription.paypalSubscriptionId
  ) {
    throw new ApiError(404, "No active PayPal subscription found");
  }

  await cancelPaypalSubscriptionService(
    subscription.paypalSubscriptionId,
    reason
  );

  subscription.status = "cancelled";
  subscription.cancelAtPeriodEnd = true;
  await subscription.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        subscriptionId: subscription.paypalSubscriptionId,
        status: subscription.status,
      },
      "PayPal subscription cancelled successfully"
    )
  );
});

// Handle Stripe webhooks
export const handleStripeWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["stripe-signature"];
  // Use rawBody if available (from webhook middleware), otherwise fallback to body
  const payload = req.rawBody || req.body;

  try {
    const event = await handleWebhook(payload, signature);

    switch (event.type) {
      // Subscription Events
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "customer.subscription.trial_will_end":
        await handleSubscriptionTrialWillEnd(event.data.object);
        break;

      // Invoice Events
      case "invoice.created":
        await handleInvoiceCreated(event.data.object);
        break;

      case "invoice.finalized":
        await handleInvoiceFinalized(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;

      case "invoice.payment_action_required":
        await handlePaymentActionRequired(event.data.object);
        break;

      // Payment Intent Events (One-time Payments)
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object);
        break;

      case "payment_intent.canceled":
        await handlePaymentIntentCanceled(event.data.object);
        break;

      // Charge Events
      case "charge.succeeded":
        await handleChargeSucceeded(event.data.object);
        break;

      case "charge.failed":
        await handleChargeFailed(event.data.object);
        break;

      default:
        logger.warn(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error("Webhook error:", error);
    throw new ApiError(
      400,
      `Webhook signature verification failed: ${error.message}`
    );
  }
});

// Handle PayPal webhooks
export const handlePayPalWebhook = asyncHandler(async (req, res) => {
  // Get raw body string (already converted from Buffer in middleware)
  const rawBody =
    req.rawBody ||
    (typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));

  // Parse event for processing
  let event;
  try {
    event = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
  } catch (parseError) {
    logger.error("Failed to parse PayPal webhook body:", {
      error: parseError.message,
      rawBodyType: typeof rawBody,
      rawBodyLength: rawBody?.length,
    });
    throw new ApiError(400, "Invalid webhook payload format");
  }

  // Check if signature headers exist
  const hasSignatureHeaders =
    req.headers["paypal-transmission-id"] &&
    req.headers["paypal-transmission-sig"] &&
    req.headers["paypal-auth-algo"] &&
    req.headers["paypal-cert-url"] &&
    req.headers["paypal-transmission-time"];

  // Check if this is a test event (from PayPal dashboard test tool)
  // Test events typically don't have signature headers OR have test event IDs
  const isTestEvent =
    !hasSignatureHeaders ||
    (event?.id?.startsWith("WH-") && !hasSignatureHeaders);

  // Verify signature only if headers exist and PAYPAL_WEBHOOK_ID is configured
  if (hasSignatureHeaders && process.env.PAYPAL_WEBHOOK_ID) {
    try {
      // Log raw body info for debugging (without sensitive data)
      logger.debug("Verifying PayPal webhook signature", {
        event_type: event?.event_type,
        event_id: event?.id,
        rawBodyLength: rawBody?.length,
        rawBodyType: typeof rawBody,
        hasAllHeaders: !!hasSignatureHeaders,
      });

      const isValid = await verifyPayPalWebhookSignature(req.headers, rawBody);
      if (!isValid) {
        logger.warn("PayPal webhook signature verification failed", {
          event_type: event?.event_type,
          event_id: event?.id,
          has_headers: !!hasSignatureHeaders,
        });
        throw new ApiError(400, "Invalid PayPal webhook signature");
      }
      logger.info("PayPal webhook signature verified successfully", {
        event_type: event?.event_type,
        event_id: event?.id,
      });
    } catch (error) {
      // If PAYPAL_WEBHOOK_ID is not set, log warning
      if (error.message.includes("PAYPAL_WEBHOOK_ID")) {
        logger.warn(
          "PAYPAL_WEBHOOK_ID not configured. Skipping signature verification."
        );
        // Allow to continue if test event
        if (!isTestEvent) {
          throw new ApiError(400, "Webhook verification not configured");
        }
      } else {
        // For signature verification failures, log but allow test events
        if (isTestEvent) {
          logger.warn(
            "Signature verification failed but treating as test event",
            {
              error: error.message,
              event_type: event?.event_type,
            }
          );
        } else {
          throw error;
        }
      }
    }
  } else {
    if (isTestEvent) {
      logger.info(
        "Processing PayPal test webhook event (signature verification skipped)",
        {
          event_type: event?.event_type,
          event_id: event?.id,
        }
      );
    } else if (!process.env.PAYPAL_WEBHOOK_ID) {
      logger.warn(
        "PAYPAL_WEBHOOK_ID not configured. Processing webhook without verification",
        {
          event_type: event?.event_type,
          event_id: event?.id,
        }
      );
    }
  }

  // Process the webhook event
  await processPayPalWebhookEvent(event);

  return res.status(200).json({
    received: true,
    event_type: event?.event_type,
    event_id: event?.id,
    message: isTestEvent
      ? "Test event processed successfully"
      : "Webhook processed successfully",
  });
});

// Webhook handlers
const handleSubscriptionCreated = async (stripeSubscription) => {
  const subscription = await Subscription.findOne({
    stripeSubscriptionId: stripeSubscription.id,
  });

  if (subscription) {
    subscription.status = stripeSubscription.status;
    subscription.currentPeriodStart = new Date(
      stripeSubscription.current_period_start * 1000
    );
    subscription.currentPeriodEnd = new Date(
      stripeSubscription.current_period_end * 1000
    );
    await subscription.save();
  }
};

const handleSubscriptionUpdated = async (stripeSubscription) => {
  const subscription = await Subscription.findOne({
    stripeSubscriptionId: stripeSubscription.id,
  });

  if (subscription) {
    subscription.status = stripeSubscription.status;
    subscription.currentPeriodStart = new Date(
      stripeSubscription.current_period_start * 1000
    );
    subscription.currentPeriodEnd = new Date(
      stripeSubscription.current_period_end * 1000
    );
    subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
    await subscription.save();
  }
};

const handleSubscriptionDeleted = async (stripeSubscription) => {
  const subscription = await Subscription.findOne({
    stripeSubscriptionId: stripeSubscription.id,
  });

  if (subscription) {
    subscription.status = "cancelled";
    await subscription.save();
  }
};

const handlePaymentSucceeded = async (invoice) => {
  const subscription = await Subscription.findOne({
    stripeSubscriptionId: invoice.subscription,
  });

  if (subscription) {
    subscription.status = "active";
    await subscription.save();

    // Create/update Payment record
    await createOrUpdatePaymentFromInvoice(
      invoice,
      "succeeded",
      subscription.userId
    );
  }
};

const handlePaymentFailed = async (invoice) => {
  const subscription = await Subscription.findOne({
    stripeSubscriptionId: invoice.subscription,
  });

  if (subscription) {
    subscription.status = "past_due";
    await subscription.save();

    // Create/update Payment record
    await createOrUpdatePaymentFromInvoice(
      invoice,
      "failed",
      subscription.userId
    );
  }
};

// ========================================
// NEW WEBHOOK HANDLERS
// ========================================

// Subscription Trial Will End
const handleSubscriptionTrialWillEnd = async (stripeSubscription) => {
  const subscription = await Subscription.findOne({
    stripeSubscriptionId: stripeSubscription.id,
  });

  if (subscription) {
    logger.warn(
      `⚠️ Trial ending soon for subscription: ${subscription._id}, ends at: ${stripeSubscription.trial_end}`
    );
    // You can add notification logic here (email, push notification, etc.)
  }
};

// Invoice Created
const handleInvoiceCreated = async (invoice) => {
  logger.info(
    `📄 Invoice created: ${invoice.id} for subscription: ${invoice.subscription}`
  );
  // Invoice created but not yet finalized
  // You can add pre-payment notification logic here
};

// Invoice Finalized
const handleInvoiceFinalized = async (invoice) => {
  logger.info(`✅ Invoice finalized: ${invoice.id}`);
  // Invoice is ready for payment
  // You can add payment reminder logic here
};

// Payment Action Required (3D Secure, etc.)
const handlePaymentActionRequired = async (invoice) => {
  const subscription = await Subscription.findOne({
    stripeSubscriptionId: invoice.subscription,
  });

  if (subscription) {
    logger.warn(
      `🔐 Payment action required for invoice: ${invoice.id}, subscription: ${subscription._id}`
    );
    // You can add notification logic to inform user about required action
  }
};

// Payment Intent Succeeded (One-time Payments)
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  try {
    // Find user by customer ID
    const user = await User.findOne({
      stripeCustomerId: paymentIntent.customer,
    });

    if (!user) {
      logger.error(`User not found for customer: ${paymentIntent.customer}`);
      return;
    }

    // Check if Payment record already exists
    let payment = await Payment.findOne({
      "stripe.paymentIntentId": paymentIntent.id,
    });

    if (payment) {
      // Update existing payment
      payment.status = "completed";
      payment.stripe.chargeId = paymentIntent.latest_charge || null;
      await payment.save();
    } else {
      // Create new Payment record
      const paymentData = {
        userId: user._id,
        amount: paymentIntent.amount, // Already in cents
        currency: paymentIntent.currency.toUpperCase(),
        status: "completed",
        stripe: {
          paymentIntentId: paymentIntent.id,
          customerId: paymentIntent.customer,
          chargeId: paymentIntent.latest_charge || null,
        },
        paymentMethod: {
          type: paymentIntent.payment_method_types?.[0] || "card",
        },
      };

      // Extract payment method details if available
      if (paymentIntent.payment_method) {
        try {
          const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
          const paymentMethod = await stripeClient.paymentMethods.retrieve(
            paymentIntent.payment_method
          );

          if (paymentMethod.card) {
            paymentData.paymentMethod = {
              type: "card",
              last4: paymentMethod.card.last4,
              brand: paymentMethod.card.brand,
              expiryMonth: paymentMethod.card.exp_month,
              expiryYear: paymentMethod.card.exp_year,
            };
          }
        } catch (error) {
          logger.error("Error retrieving payment method:", error);
        }
      }

      // Extract plan info from metadata if available
      if (paymentIntent.metadata?.planId) {
        paymentData.subscription = {
          plan: paymentIntent.metadata.planType || "monthly",
        };
      }

      payment = new Payment(paymentData);
      await payment.save();
    }

    // Upgrade subscription if plan info is in metadata
    if (paymentIntent.metadata?.planId && paymentIntent.metadata?.planType) {
      try {
        const planId = paymentIntent.metadata.planId;
        const planType = paymentIntent.metadata.planType;
        const billingCycle = paymentIntent.metadata.billingCycle || "monthly";

        // Find the plan
        const mongoose = (await import("mongoose")).default;
        let plan = null;
        if (mongoose.Types.ObjectId.isValid(planId)) {
          plan = await SubscriptionPlan.findById(planId);
        }
        if (!plan) {
          plan = await SubscriptionPlan.findOne({
            type: planType,
            status: "active",
          });
        }

        if (plan) {
          // Get or create subscription
          let subscription = await Subscription.findOne({ userId: user._id });

          // Calculate period end date
          const periodEnd = new Date();
          if (billingCycle === "yearly") {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
          }

          const amount =
            billingCycle === "yearly" ? plan.price.yearly : plan.price.monthly;
          const currency = plan.price.currency || "USD";

          if (subscription) {
            // Update existing subscription
            subscription.planId = plan._id;
            subscription.plan = plan.type;
            subscription.status = "active";
            subscription.billingCycle = billingCycle;
            subscription.currentPeriodStart = new Date();
            subscription.currentPeriodEnd = periodEnd;
            subscription.cancelAtPeriodEnd = false;
            subscription.amount = amount;
            subscription.currency = currency;
            subscription.limits = plan.features;
            subscription.features = plan.features;
            // Preserve usage data
            await subscription.save();
          } else {
            // Create new subscription
            subscription = new Subscription({
              userId: user._id,
              planId: plan._id,
              plan: plan.type,
              status: "active",
              billingCycle: billingCycle,
              currentPeriodStart: new Date(),
              currentPeriodEnd: periodEnd,
              amount: amount,
              currency: currency,
              limits: plan.features,
              features: plan.features,
            });
            await subscription.save();
          }

          logger.info(
            `✅ Subscription upgraded: User ${user._id} → Plan ${plan.type} (${billingCycle})`
          );
        }
      } catch (error) {
        logger.error(
          "Error upgrading subscription after payment success:",
          error
        );
        // Don't throw - payment is already recorded
      }
    }

    logger.info(
      `✅ Payment Intent succeeded: ${paymentIntent.id}, Payment record: ${payment._id}`
    );
  } catch (error) {
    logger.error("Error handling payment_intent.succeeded:", error);
  }
};

// Payment Intent Failed (One-time Payments)
const handlePaymentIntentFailed = async (paymentIntent) => {
  try {
    const user = await User.findOne({
      stripeCustomerId: paymentIntent.customer,
    });

    if (!user) {
      logger.error(`User not found for customer: ${paymentIntent.customer}`);
      return;
    }

    // Find or create Payment record
    let payment = await Payment.findOne({
      "stripe.paymentIntentId": paymentIntent.id,
    });

    const paymentData = {
      userId: user._id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      status: "failed",
      stripe: {
        paymentIntentId: paymentIntent.id,
        customerId: paymentIntent.customer,
      },
      error: {
        code: paymentIntent.last_payment_error?.code || "payment_failed",
        message: paymentIntent.last_payment_error?.message || "Payment failed",
        details: paymentIntent.last_payment_error?.decline_code || null,
      },
    };

    if (payment) {
      // Update existing payment
      Object.assign(payment, paymentData);
      await payment.save();
    } else {
      // Create new Payment record
      payment = new Payment(paymentData);
      await payment.save();
    }

    logger.error(
      `❌ Payment Intent failed: ${paymentIntent.id}, Payment record: ${payment._id}`
    );

    // Restore original plan if previous plan info exists in metadata
    if (
      paymentIntent.metadata?.previousPlanId ||
      paymentIntent.metadata?.previousPlanType
    ) {
      try {
        const previousPlanId = paymentIntent.metadata.previousPlanId;
        const previousPlanType =
          paymentIntent.metadata.previousPlanType || "free";

        // Find previous plan
        const mongoose = (await import("mongoose")).default;
        let previousPlan = null;
        if (previousPlanId && mongoose.Types.ObjectId.isValid(previousPlanId)) {
          previousPlan = await SubscriptionPlan.findById(previousPlanId);
        }
        if (!previousPlan && previousPlanType) {
          previousPlan = await SubscriptionPlan.findOne({
            type: previousPlanType,
            status: "active",
          });
        }

        // Get current subscription
        let subscription = await Subscription.findOne({ userId: user._id });

        if (subscription && previousPlan) {
          // Restore to previous plan
          subscription.planId = previousPlan._id;
          subscription.plan = previousPlan.type;
          subscription.limits = previousPlan.features;
          subscription.features = previousPlan.features;
          // Keep status active if it was active before
          if (subscription.status === "active") {
            // Keep it active
          }
          await subscription.save();
          logger.info(
            `🔄 Plan restored after payment failure: User ${user._id} → Previous Plan ${previousPlan.type}`
          );
        } else if (subscription && previousPlanType === "free") {
          // Restore to free plan
          const freePlan = await SubscriptionPlan.findOne({
            type: "free",
            status: "active",
          });
          if (freePlan) {
            subscription.planId = freePlan._id;
            subscription.plan = "free";
            subscription.limits = freePlan.features;
            subscription.features = freePlan.features;
            await subscription.save();
            logger.info(
              `🔄 Plan restored after payment failure: User ${user._id} → Free Plan`
            );
          }
        }
      } catch (error) {
        logger.error(
          "Error restoring previous plan after payment failure:",
          error
        );
        // Don't throw - payment failure is already recorded
      }
    }
  } catch (error) {
    logger.error("Error handling payment_intent.payment_failed:", error);
  }
};

// Charge Succeeded
const handleChargeSucceeded = async (charge) => {
  logger.info(
    `💳 Charge succeeded: ${charge.id} for customer: ${charge.customer}`
  );
  // Charge events are usually handled by payment_intent events
  // But we can use this for additional logging or notifications
};

// Charge Failed
const handleChargeFailed = async (charge) => {
  logger.error(
    `❌ Charge failed: ${charge.id} for customer: ${charge.customer}`
  );
  // Charge events are usually handled by payment_intent events
  // But we can use this for additional logging or notifications
};

// Payment Intent Canceled
const handlePaymentIntentCanceled = async (paymentIntent) => {
  try {
    // Find Payment record
    const payment = await Payment.findOne({
      "stripe.paymentIntentId": paymentIntent.id,
    });

    if (payment) {
      payment.status = "cancelled";
      await payment.save();
      logger.warn(
        `🚫 Payment Intent canceled: ${paymentIntent.id}, Payment record: ${payment._id}`
      );
    } else {
      logger.warn(
        `⚠️ Payment Intent canceled but no Payment record found: ${paymentIntent.id}`
      );
    }

    // Restore original plan if previous plan info exists in metadata
    if (
      paymentIntent.metadata?.previousPlanId ||
      paymentIntent.metadata?.previousPlanType
    ) {
      try {
        const user = await User.findOne({
          stripeCustomerId: paymentIntent.customer,
        });

        if (user) {
          const previousPlanId = paymentIntent.metadata.previousPlanId;
          const previousPlanType =
            paymentIntent.metadata.previousPlanType || "free";

          // Find previous plan
          const mongoose = (await import("mongoose")).default;
          let previousPlan = null;
          if (
            previousPlanId &&
            mongoose.Types.ObjectId.isValid(previousPlanId)
          ) {
            previousPlan = await SubscriptionPlan.findById(previousPlanId);
          }
          if (!previousPlan && previousPlanType) {
            previousPlan = await SubscriptionPlan.findOne({
              type: previousPlanType,
              status: "active",
            });
          }

          // Get current subscription
          let subscription = await Subscription.findOne({ userId: user._id });

          if (subscription && previousPlan) {
            // Restore to previous plan
            subscription.planId = previousPlan._id;
            subscription.plan = previousPlan.type;
            subscription.limits = previousPlan.features;
            subscription.features = previousPlan.features;
            // Keep status active if it was active before
            if (subscription.status === "active") {
              // Keep it active
            }
            await subscription.save();
            logger.info(
              `🔄 Plan restored: User ${user._id} → Previous Plan ${previousPlan.type}`
            );
          } else if (subscription && previousPlanType === "free") {
            // Restore to free plan
            const freePlan = await SubscriptionPlan.findOne({
              type: "free",
              status: "active",
            });
            if (freePlan) {
              subscription.planId = freePlan._id;
              subscription.plan = "free";
              subscription.limits = freePlan.features;
              subscription.features = freePlan.features;
              await subscription.save();
              logger.info(`🔄 Plan restored: User ${user._id} → Free Plan`);
            }
          }
        }
      } catch (error) {
        logger.error(
          "Error restoring previous plan after cancellation:",
          error
        );
        // Don't throw - payment cancellation is already recorded
      }
    }
  } catch (error) {
    logger.error("Error handling payment_intent.canceled:", error);
  }
};

// ========================================
// PAYPAL WEBHOOK HELPERS
// ========================================

const processPayPalWebhookEvent = async (event) => {
  const eventType = event?.event_type;
  const resource = event?.resource || {};

  try {
    switch (eventType) {
      case "BILLING.SUBSCRIPTION.ACTIVATED":
      case "BILLING.SUBSCRIPTION.UPDATED":
      case "BILLING.SUBSCRIPTION.RE-ACTIVATED":
        await syncPayPalSubscription(resource);
        break;
      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.SUSPENDED":
        await markPayPalSubscriptionStatus(
          resource,
          eventType === "BILLING.SUBSCRIPTION.SUSPENDED"
            ? "inactive"
            : "cancelled"
        );
        break;
      case "PAYMENT.SALE.COMPLETED":
        await recordPayPalPayment(resource, "completed");
        break;
      case "PAYMENT.SALE.DENIED":
        await recordPayPalPayment(resource, "failed");
        break;
      default:
        logger.info(`ℹ️ PayPal webhook received: ${eventType}`);
    }
  } catch (error) {
    logger.error("Error processing PayPal webhook:", error);
    throw error;
  }
};

const resolveUserIdFromResource = async (resource) => {
  if (resource.custom_id) {
    return resource.custom_id;
  }

  const subscriptionRecord = await Subscription.findOne({
    paypalSubscriptionId: resource.id || resource.billing_agreement_id,
  });
  if (subscriptionRecord) {
    return subscriptionRecord.userId;
  }

  const paymentRecord = await Payment.findOne({
    "paypal.subscriptionId": resource.id || resource.billing_agreement_id,
  });
  return paymentRecord?.userId || null;
};

const syncPayPalSubscription = async (resource) => {
  const subscriptionId = resource.id;
  const planId = resource.plan_id;

  if (!subscriptionId || !planId) {
    logger.warn("PayPal subscription sync skipped - missing identifiers", {
      subscriptionId,
      planId,
      resourceKeys: Object.keys(resource || {}),
    });
    return;
  }

  logger.info(
    `Syncing PayPal subscription: ${subscriptionId}, Plan: ${planId}`
  );

  const plan = await SubscriptionPlan.findOne({
    $or: [
      { "paypal.planIdMonthly": planId },
      { "paypal.planIdYearly": planId },
    ],
  });

  if (!plan) {
    logger.warn(
      `PayPal plan not mapped in database: ${planId}. Available plans:`,
      await SubscriptionPlan.find(
        {},
        { name: 1, "paypal.planIdMonthly": 1, "paypal.planIdYearly": 1 }
      )
    );
    return;
  }

  const billingCycle =
    plan.paypal?.planIdYearly === planId ? "yearly" : "monthly";
  const amount =
    billingCycle === "yearly" ? plan.price.yearly : plan.price.monthly;
  const currency = (plan.price.currency || "USD").toUpperCase();

  const userId = await resolveUserIdFromResource(resource);
  if (!userId) {
    logger.warn(
      `Unable to resolve user for PayPal subscription ${subscriptionId}. ` +
        `This might be a test event or subscription not yet linked to a user.`
    );
    // For test events, this is expected - don't throw error
    return;
  }

  logger.info(`Applying plan ${plan.name} (${billingCycle}) to user ${userId}`);

  await applyPlanToUserSubscription({
    userId,
    plan,
    billingCycle,
    amount,
    currency,
    provider: "paypal",
    paypalInfo: {
      subscriptionId,
      planId,
      approvalUrl: null,
    },
  });

  logger.info(
    `Successfully synced PayPal subscription ${subscriptionId} for user ${userId}`
  );
};

const markPayPalSubscriptionStatus = async (resource, status) => {
  const subscriptionId =
    resource.id || resource.billing_agreement_id || resource.subscription_id;
  if (!subscriptionId) {
    return;
  }

  const subscription = await Subscription.findOne({
    paypalSubscriptionId: subscriptionId,
  });

  if (subscription) {
    subscription.status = status;
    subscription.cancelAtPeriodEnd = status === "cancelled";
    await subscription.save();
  }
};

const recordPayPalPayment = async (resource, status) => {
  const subscriptionId =
    resource.billing_agreement_id || resource.id || resource.subscription_id;
  if (!subscriptionId) {
    return;
  }

  const amountValue =
    Number(resource.amount?.total || resource.amount?.value || 0) || 0;
  const currency = (
    resource.amount?.currency ||
    resource.amount?.currency_code ||
    "USD"
  ).toUpperCase();

  let payment = await Payment.findOne({
    "paypal.subscriptionId": subscriptionId,
  }).sort({ createdAt: -1 });

  if (!payment) {
    const userId = await resolveUserIdFromResource(resource);
    if (!userId) {
      logger.warn(
        `PayPal payment event without matching payment record: ${subscriptionId}`
      );
      return;
    }

    payment = new Payment({
      userId,
      amount: Math.round(amountValue * 100),
      currency,
      status: status === "completed" ? "completed" : "failed",
      paypal: {
        subscriptionId,
        captureId: resource.id,
      },
      subscription: {
        plan: "monthly",
      },
      metadata: {
        source: "paypal_webhook",
      },
    });
  } else {
    payment.status = status === "completed" ? "completed" : "failed";
    payment.paypal = payment.paypal || {};
    payment.paypal.captureId = resource.id;
  }

  if (status !== "completed" && resource?.reason_code) {
    payment.error = {
      code: resource.reason_code,
      message: resource?.reason || "Payment failed",
      details: resource?.state || "failed",
    };
  }

  await payment.save();
};

// ========================================
// HELPER FUNCTIONS
// ========================================

// Helper: Create or Update Payment record from Invoice
const createOrUpdatePaymentFromInvoice = async (invoice, status, userId) => {
  try {
    if (!invoice.subscription) {
      // One-time payment invoice (not subscription)
      return;
    }

    // Find existing Payment record by invoice ID
    let payment = await Payment.findOne({
      "stripe.invoiceId": invoice.id,
    });

    const paymentData = {
      userId: userId,
      amount: invoice.amount_paid || invoice.amount_due,
      currency: invoice.currency.toUpperCase(),
      status: status === "succeeded" ? "completed" : status,
      stripe: {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription,
        customerId: invoice.customer,
        chargeId: invoice.charge || null,
        paymentIntentId: invoice.payment_intent || null,
      },
    };

    // Extract payment method details from invoice
    if (invoice.payment_intent) {
      try {
        const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
        const paymentIntent = await stripeClient.paymentIntents.retrieve(
          invoice.payment_intent
        );

        if (paymentIntent.payment_method) {
          const paymentMethod = await stripeClient.paymentMethods.retrieve(
            paymentIntent.payment_method
          );

          if (paymentMethod.card) {
            paymentData.paymentMethod = {
              type: "card",
              last4: paymentMethod.card.last4,
              brand: paymentMethod.card.brand,
              expiryMonth: paymentMethod.card.exp_month,
              expiryYear: paymentMethod.card.exp_year,
            };
          }
        }
      } catch (error) {
        logger.error("Error retrieving payment method from invoice:", error);
      }
    }

    // Extract subscription details
    if (invoice.subscription) {
      const subscription = await Subscription.findOne({
        stripeSubscriptionId: invoice.subscription,
      });

      if (subscription) {
        paymentData.subscription = {
          plan: subscription.billingCycle || "monthly",
          startDate: subscription.currentPeriodStart,
          endDate: subscription.currentPeriodEnd,
          autoRenew: !subscription.cancelAtPeriodEnd,
        };
      }
    }

    // Add error details if payment failed
    if (status === "failed" && invoice.last_payment_error) {
      paymentData.error = {
        code: invoice.last_payment_error.code || "payment_failed",
        message: invoice.last_payment_error.message || "Payment failed",
        details: invoice.last_payment_error.decline_code || null,
      };
    }

    if (payment) {
      // Update existing payment
      Object.assign(payment, paymentData);
      await payment.save();
    } else {
      // Create new Payment record
      payment = new Payment(paymentData);
      await payment.save();
    }

    return payment;
  } catch (error) {
    logger.error("Error creating/updating payment from invoice:", error);
    throw error;
  }
};

// Get payment methods
export const getPaymentMethods = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId);

  if (!user || !user.stripeCustomerId) {
    return res
      .status(200)
      .json(
        new ApiResponse(200, { paymentMethods: [] }, "No payment methods found")
      );
  }

  // This would require additional Stripe API calls
  // For now, return empty array
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { paymentMethods: [] },
        "Payment methods retrieved successfully"
      )
    );
});

// Check Payment Status
export const checkPaymentStatus = asyncHandler(async (req, res) => {
  const { paymentIntentId } = req.params;
  const userId = req.user._id;

  if (!paymentIntentId) {
    throw new ApiError(400, "Payment Intent ID is required");
  }

  try {
    const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Retrieve Payment Intent from Stripe
    const paymentIntent = await stripeClient.paymentIntents.retrieve(
      paymentIntentId
    );

    // Verify ownership
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (paymentIntent.customer !== user.stripeCustomerId) {
      throw new ApiError(403, "Payment intent does not belong to this user");
    }

    // Find Payment record in database
    const payment = await Payment.findOne({
      "stripe.paymentIntentId": paymentIntentId,
    });

    // Map Stripe status to our status
    let dbStatus = payment?.status || "pending";
    const stripeStatus = paymentIntent.status;

    // Sync status if different
    if (payment) {
      if (stripeStatus === "succeeded" && dbStatus !== "completed") {
        dbStatus = "completed";
        payment.status = "completed";
        await payment.save();
      } else if (stripeStatus === "canceled" && dbStatus !== "cancelled") {
        dbStatus = "cancelled";
        payment.status = "cancelled";
        await payment.save();
      } else if (
        stripeStatus === "requires_payment_method" ||
        stripeStatus === "requires_confirmation"
      ) {
        dbStatus = "pending";
      } else if (stripeStatus === "processing") {
        dbStatus = "processing";
        payment.status = "processing";
        await payment.save();
      }
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          paymentIntentId: paymentIntent.id,
          stripeStatus: stripeStatus,
          dbStatus: dbStatus,
          amount: paymentIntent.amount / 100, // Convert from cents
          currency: paymentIntent.currency.toUpperCase(),
          paymentId: payment?._id || null,
          metadata: paymentIntent.metadata,
          lastPaymentError: paymentIntent.last_payment_error || null,
          nextAction: paymentIntent.next_action || null,
        },
        "Payment status retrieved successfully"
      )
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Failed to check payment status: ${error.message}`);
  }
});

// Retry Payment (for failed or canceled payments)
export const retryPayment = asyncHandler(async (req, res) => {
  const { paymentIntentId } = req.body;
  const userId = req.user._id;

  if (!paymentIntentId) {
    throw new ApiError(400, "Payment Intent ID is required");
  }

  try {
    const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Retrieve existing Payment Intent
    const existingPaymentIntent = await stripeClient.paymentIntents.retrieve(
      paymentIntentId
    );

    // Verify ownership
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (existingPaymentIntent.customer !== user.stripeCustomerId) {
      throw new ApiError(403, "Payment intent does not belong to this user");
    }

    // Check if payment can be retried
    if (
      existingPaymentIntent.status === "succeeded" ||
      existingPaymentIntent.status === "processing"
    ) {
      throw new ApiError(
        400,
        `Cannot retry payment. Current status: ${existingPaymentIntent.status}`
      );
    }

    // Find existing Payment record
    const existingPayment = await Payment.findOne({
      "stripe.paymentIntentId": paymentIntentId,
    });

    // Create new Payment Intent with same details
    const newPaymentIntent = await stripeClient.paymentIntents.create({
      amount: existingPaymentIntent.amount,
      currency: existingPaymentIntent.currency,
      customer: existingPaymentIntent.customer,
      metadata: existingPaymentIntent.metadata,
      description: existingPaymentIntent.description,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Update or create Payment record
    if (existingPayment) {
      existingPayment.stripe.paymentIntentId = newPaymentIntent.id;
      existingPayment.status = "pending";
      await existingPayment.save();
    } else {
      const newPayment = new Payment({
        userId: user._id,
        amount: existingPaymentIntent.amount,
        currency: existingPaymentIntent.currency.toUpperCase(),
        status: "pending",
        stripe: {
          paymentIntentId: newPaymentIntent.id,
          customerId: existingPaymentIntent.customer,
        },
        metadata: {
          source: "payment_retry",
          originalPaymentIntentId: paymentIntentId,
        },
      });
      await newPayment.save();
    }

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          clientSecret: newPaymentIntent.client_secret,
          paymentIntentId: newPaymentIntent.id,
          originalPaymentIntentId: paymentIntentId,
          amount: newPaymentIntent.amount / 100,
          currency: newPaymentIntent.currency.toUpperCase(),
        },
        "Payment retry initiated successfully"
      )
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Failed to retry payment: ${error.message}`);
  }
});

// Cancel subscription
export const cancelStripeSubscription = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const subscription = await Subscription.findOne({ userId });

  if (!subscription || !subscription.stripeSubscriptionId) {
    throw new ApiError(404, "No active Stripe subscription found");
  }

  try {
    // Cancel subscription in Stripe
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);

    // Update subscription status
    subscription.status = "cancelled";
    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          subscriptionId: subscription.stripeSubscriptionId,
          status: subscription.status,
        },
        "Subscription cancelled successfully"
      )
    );
  } catch (error) {
    throw new ApiError(500, `Failed to cancel subscription: ${error.message}`);
  }
});
