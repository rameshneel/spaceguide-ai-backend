import axios from "axios";
import {
  Client,
  Environment,
  SubscriptionsController,
} from "@paypal/paypal-server-sdk";
import logger from "../../utils/logger.js";
import {
  calculatePeriodEnd,
  createSubscriptionData,
  createDefaultUsage,
} from "../../utils/subscriptionUtils.js";
import SubscriptionPlan from "../../models/subscriptionPlan.model.js";
import Subscription from "../../models/subscription.model.js";

const PAYPAL_MODE = (process.env.PAYPAL_MODE || "sandbox").toLowerCase();
const PAYPAL_BASE_URL =
  PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://spaceguideai.com";
const PAYPAL_HOME_URL =
  process.env.PAYPAL_HOME_URL ||
  FRONTEND_URL.replace(/^http:\/\//i, "https://");
const PAYPAL_RETURN_URL =
  process.env.PAYPAL_RETURN_URL || `${FRONTEND_URL}/billing/paypal/success`;
const PAYPAL_CANCEL_URL =
  process.env.PAYPAL_CANCEL_URL || `${FRONTEND_URL}/billing/paypal/cancel`;
const PAYPAL_BRAND_NAME =
  process.env.PAYPAL_BRAND_NAME || "SpaceGuideAI Subscriptions";

let paypalClientInstance = null;
let subscriptionsControllerInstance = null;
let cachedToken = {
  token: null,
  expiresAt: 0,
};

const getPaypalClient = () => {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    throw new Error(
      "PayPal credentials are not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET."
    );
  }

  if (!paypalClientInstance) {
    paypalClientInstance = new Client({
      environment:
        PAYPAL_MODE === "live" ? Environment.Production : Environment.Sandbox,
      clientCredentialsAuthCredentials: {
        oAuthClientId: process.env.PAYPAL_CLIENT_ID,
        oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET,
      },
    });
  }

  return paypalClientInstance;
};

const getSubscriptionsController = () => {
  if (!subscriptionsControllerInstance) {
    subscriptionsControllerInstance = new SubscriptionsController(
      getPaypalClient()
    );
  }

  return subscriptionsControllerInstance;
};

const getAccessToken = async () => {
  const now = Date.now();
  if (cachedToken.token && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  try {
    const token =
      await getPaypalClient().clientCredentialsAuthManager.fetchToken();

    if (!token?.accessToken) {
      throw new Error("PayPal access token not received");
    }

    const expiresInMs = Number(token.expiresIn ?? 300n) * 1000 - 60 * 1000; // Refresh 60s early
    cachedToken = {
      token: token.accessToken,
      expiresAt: Date.now() + Math.max(expiresInMs, 30 * 1000),
    };
    logger.debug("PayPal access token refreshed");
    return cachedToken.token;
  } catch (error) {
    logger.error("Failed to get PayPal access token:", {
      error: error.message,
      response: error.response?.data,
    });
    throw new Error(`PayPal authentication failed: ${error.message}`);
  }
};

const createAuthorizedHttpClient = async () => {
  const token = await getAccessToken();
  return axios.create({
    baseURL: PAYPAL_BASE_URL,
    timeout: 20000,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
};

const ensurePaypalProduct = async (plan) => {
  plan.paypal = plan.paypal || {};
  if (plan.paypal.productId) {
    return plan.paypal.productId;
  }

  try {
    const http = await createAuthorizedHttpClient();
    const payload = {
      name: plan.displayName || plan.name,
      description: plan.description?.slice(0, 127) || "SpaceGuideAI Plan",
      type: "SERVICE",
      category: "SOFTWARE",
      home_url: PAYPAL_HOME_URL,
    };

    logger.debug("Creating PayPal product:", { planName: plan.name, payload });
    const { data } = await http.post("/v1/catalogs/products", payload);

    if (!data?.id) {
      throw new Error(
        "PayPal product creation failed - no product ID returned"
      );
    }

    plan.paypal.productId = data.id;
    plan.markModified("paypal");
    await plan.save();
    logger.info(
      `✅ Created PayPal product for plan ${plan.name}: ${plan.paypal.productId}`
    );
    return plan.paypal.productId;
  } catch (error) {
    logger.error("Failed to create PayPal product:", {
      planName: plan.name,
      error: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw new Error(
      `PayPal product creation failed: ${
        error.response?.data?.message || error.message
      }`
    );
  }
};

const buildBillingCycle = (billingCycle, amount, currency) => {
  const intervalUnit = billingCycle === "yearly" ? "YEAR" : "MONTH";
  return [
    {
      tenureType: "REGULAR",
      sequence: 1,
      frequency: {
        intervalUnit,
        intervalCount: 1,
      },
      totalCycles: 0,
      pricingScheme: {
        fixedPrice: {
          value: Number(amount || 0).toFixed(2),
          currencyCode: currency.toUpperCase(),
        },
      },
    },
  ];
};

const ensurePaypalPlan = async (plan, billingCycle, retryCount = 0) => {
  const MAX_RETRIES = 1; // Only retry once if product ID is invalid
  plan.paypal = plan.paypal || {};
  const field = billingCycle === "yearly" ? "planIdYearly" : "planIdMonthly";
  if (plan.paypal[field]) {
    return plan.paypal[field];
  }

  try {
    const productId = await ensurePaypalProduct(plan);
    const amount =
      billingCycle === "yearly" ? plan.price.yearly : plan.price.monthly;
    const currency = (plan.price.currency || "USD").toUpperCase();

    const planRequest = {
      productId,
      name: `${plan.displayName || plan.name} (${billingCycle})`,
      description: plan.description?.slice(0, 127) || "SpaceGuideAI plan",
      status: "ACTIVE",
      billingCycles: buildBillingCycle(billingCycle, amount, currency),
      paymentPreferences: {
        autoBillOutstanding: true,
        setupFeeFailureAction: "CONTINUE",
        paymentFailureThreshold: 3,
      },
      taxes: {
        percentage: "0",
        inclusive: false,
      },
    };

    logger.debug("Creating PayPal plan:", {
      planName: plan.name,
      billingCycle,
      planRequest,
    });
    const controller = getSubscriptionsController();
    const { result, statusCode } = await controller.createBillingPlan({
      prefer: "return=representation",
      body: planRequest,
    });

    if (!result?.id) {
      throw new Error("PayPal plan creation failed - no plan ID returned");
    }

    if (result.status !== "ACTIVE") {
      logger.debug(`Activating PayPal plan: ${result.id}`);
      await controller.activateBillingPlan(result.id);
    }

    plan.paypal[field] = result.id;
    plan.markModified("paypal");
    await plan.save();
    logger.info(
      `✅ Created PayPal plan for ${plan.name} (${billingCycle}): ${result.id}`
    );
    return result.id;
  } catch (error) {
    // Parse error response (might be stringified JSON)
    let errorDetails = {};
    try {
      const rawError =
        error.response?.data || error.body || error.message || "{}";
      errorDetails =
        typeof rawError === "string" ? JSON.parse(rawError) : rawError;
    } catch (parseError) {
      // If parsing fails, try to extract from error message
      errorDetails = { message: error.message || String(error) };
    }

    const statusCode =
      error.statusCode || error.response?.status || error.status;
    const errorIssue =
      errorDetails.details?.[0]?.issue || errorDetails.issue || "";
    const errorMessage = errorDetails.message || error.message || "";

    const isInvalidProductId =
      statusCode === 404 &&
      (errorIssue === "INVALID_RESOURCE_ID" ||
        errorMessage.toLowerCase().includes("invalid product id"));

    // If product ID is invalid and we haven't retried yet, clear stored IDs and retry
    if (isInvalidProductId && retryCount < MAX_RETRIES) {
      const invalidProductId = plan.paypal?.productId;

      logger.warn(
        `Invalid PayPal product ID detected, clearing and recreating: ${invalidProductId}`,
        {
          planId: plan._id,
          planName: plan.name,
          billingCycle,
          errorDetails,
        }
      );

      // Clear both product and plan IDs
      plan.paypal = plan.paypal || {};
      plan.paypal.productId = undefined;
      plan.paypal[field] = undefined;
      plan.markModified("paypal");
      await plan.save();

      logger.info("Retrying PayPal plan creation with new product ID");
      return ensurePaypalPlan(plan, billingCycle, retryCount + 1);
    }

    logger.error("Failed to create PayPal plan:", {
      planName: plan.name,
      billingCycle,
      error: error.message,
      response: errorDetails,
      status: statusCode,
      isInvalidProductId,
      retryCount,
    });

    throw new Error(
      `PayPal plan creation failed: ${
        errorDetails.message ||
        errorDetails.details?.[0]?.description ||
        error.message
      }`
    );
  }
};

export const createPayPalSubscriptionSession = async ({
  user,
  plan,
  billingCycle,
  useSDKFlow = false, // Flag to indicate if using PayPal SDK (popup) flow
  retryCount = 0,
}) => {
  const MAX_RETRIES = 1; // Only retry once if plan ID is invalid

  try {
    logger.debug("Creating PayPal subscription session:", {
      userId: user._id,
      planId: plan._id,
      planName: plan.name,
      billingCycle,
      useSDKFlow,
      retryCount,
    });

    const paypalPlanId = await ensurePaypalPlan(plan, billingCycle);

    const controller = getSubscriptionsController();

    // For SDK flow (vault: true), we don't need returnUrl/cancelUrl
    // The SDK handles approval internally via popup
    const subscriptionBody = {
      planId: paypalPlanId,
      customId: `${user._id}`,
      applicationContext: {
        brandName: PAYPAL_BRAND_NAME,
        userAction: "SUBSCRIBE_NOW",
      },
      subscriber: {
        name: {
          givenName: user.firstName || user.name || "Subscriber",
          surname: user.lastName || "SpaceGuideAI",
        },
      },
    };

    // For SDK flow, use a placeholder URL since SDK handles approval internally
    // PayPal API still requires returnUrl/cancelUrl, but SDK intercepts the flow
    if (useSDKFlow) {
      // Use current frontend URL as fallback - SDK will handle the actual flow
      subscriptionBody.applicationContext.returnUrl = `${FRONTEND_URL}/payment/success`;
      subscriptionBody.applicationContext.cancelUrl = `${FRONTEND_URL}/payment/cancel`;
    } else {
      subscriptionBody.applicationContext.returnUrl = PAYPAL_RETURN_URL;
      subscriptionBody.applicationContext.cancelUrl = PAYPAL_CANCEL_URL;
    }

    logger.debug("PayPal subscription request body:", subscriptionBody);
    const { result, statusCode } = await controller.createSubscription({
      body: subscriptionBody,
    });

    if (!result?.id) {
      throw new Error(
        "PayPal subscription creation failed - no subscription ID returned"
      );
    }

    const approvalLink = result.links?.find(
      (link) => link.rel === "approve"
    )?.href;

    logger.info("PayPal subscription created:", {
      subscriptionId: result.id,
      status: result.status,
      hasApprovalLink: !!approvalLink,
      useSDKFlow,
    });

    // For SDK flow, approval link might not be needed, but PayPal still returns it
    // For redirect flow, approval link is required
    if (!useSDKFlow && !approvalLink) {
      throw new Error("PayPal did not return an approval link");
    }

    return {
      subscriptionId: result.id,
      approvalUrl: approvalLink || null, // May be null for SDK flow
      status: result.status,
      planId: paypalPlanId,
    };
  } catch (error) {
    // Parse error response (might be stringified JSON)
    let errorDetails = {};
    try {
      const rawError =
        error.response?.data || error.body || error.message || "{}";
      errorDetails =
        typeof rawError === "string" ? JSON.parse(rawError) : rawError;
    } catch (parseError) {
      // If parsing fails, try to extract from error message
      errorDetails = { message: error.message || String(error) };
    }

    // Check if error is INVALID_RESOURCE_ID (plan doesn't exist in PayPal)
    const statusCode =
      error.statusCode || error.response?.status || error.status;
    const errorName = errorDetails.name || "";
    const errorIssue =
      errorDetails.details?.[0]?.issue || errorDetails.issue || "";
    const errorMessage = errorDetails.message || error.message || "";

    const isInvalidPlanId =
      statusCode === 404 ||
      errorName === "RESOURCE_NOT_FOUND" ||
      errorIssue === "INVALID_RESOURCE_ID" ||
      errorMessage.toLowerCase().includes("resource does not exist") ||
      errorMessage.toLowerCase().includes("invalid_resource_id");

    logger.debug("PayPal error analysis:", {
      statusCode,
      errorName,
      errorIssue,
      errorMessage: errorMessage.substring(0, 100),
      isInvalidPlanId,
      retryCount,
      errorDetails: JSON.stringify(errorDetails).substring(0, 200),
    });

    // If plan ID is invalid and we haven't retried yet, clear the stored plan ID and retry
    if (isInvalidPlanId && retryCount < MAX_RETRIES) {
      const field =
        billingCycle === "yearly" ? "planIdYearly" : "planIdMonthly";
      const invalidPlanId = plan.paypal?.[field];

      logger.warn(
        `Invalid PayPal plan ID detected, clearing and recreating: ${invalidPlanId}`,
        {
          planId: plan._id,
          planName: plan.name,
          billingCycle,
          errorDetails,
        }
      );

      // Clear the invalid plan ID
      plan.paypal = plan.paypal || {};
      plan.paypal[field] = undefined;
      plan.markModified("paypal");
      await plan.save();

      // Reload plan from database to ensure fresh data
      const refreshedPlan = await SubscriptionPlan.findById(plan._id);
      if (!refreshedPlan) {
        throw new Error(
          `Plan not found after clearing invalid PayPal plan ID: ${plan._id}`
        );
      }

      // Retry with a fresh plan creation
      logger.info("Retrying PayPal subscription creation with new plan ID");
      return createPayPalSubscriptionSession({
        user,
        plan: refreshedPlan,
        billingCycle,
        useSDKFlow,
        retryCount: retryCount + 1,
      });
    }

    logger.error("Failed to create PayPal subscription session:", {
      userId: user._id,
      planId: plan._id,
      planName: plan.name,
      billingCycle,
      error: error.message,
      response: errorDetails,
      status: statusCode,
      stack: error.stack,
      isInvalidPlanId,
      retryCount,
    });

    // Extract detailed error message from PayPal response
    const errorMessagePaypal =
      errorDetails.message ||
      errorDetails.details?.[0]?.description ||
      error.message ||
      "Failed to create PayPal subscription";

    throw new Error(
      `PayPal subscription creation failed: ${errorMessagePaypal}`
    );
  }
};

export const getPayPalSubscriptionDetails = async (subscriptionId) => {
  // Validate subscription ID format (PayPal subscription IDs start with "I-")
  if (!subscriptionId || typeof subscriptionId !== "string") {
    throw new Error("Invalid subscription ID: must be a non-empty string");
  }

  if (!subscriptionId.startsWith("I-")) {
    logger.warn("Subscription ID doesn't match PayPal format (should start with 'I-'):", {
      subscriptionId,
      length: subscriptionId.length,
    });
    // Still try to fetch, but log warning
  }

  try {
    const controller = getSubscriptionsController();
    const { result } = await controller.getSubscription({
      id: subscriptionId,
    });
    
    if (!result) {
      throw new Error("PayPal API returned empty result");
    }
    
    // Log response structure for debugging
    logger.debug("PayPal subscription details response:", {
      subscriptionId,
      hasStatus: !!result.status,
      status: result.status,
      hasPlanId: !!result.plan_id,
      planId: result.plan_id,
      keys: Object.keys(result || {}),
    });
    
    return result;
  } catch (error) {
    // Parse PayPal SDK error response
    let errorMessage = "Unknown error";
    let errorDetails = {};

    try {
      // PayPal SDK errors have specific structure
      if (error.response) {
        errorDetails = error.response.data || error.response.body || {};
        errorMessage = errorDetails.message || errorDetails.name || error.message || "The error response";
      } else if (error.body) {
        errorDetails = typeof error.body === "string" ? JSON.parse(error.body) : error.body;
        errorMessage = errorDetails.message || errorDetails.name || error.message || "The error response";
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Extract more details if available
      if (errorDetails.details) {
        errorDetails.details.forEach((detail) => {
          if (detail.description) {
            errorMessage += `: ${detail.description}`;
          }
        });
      }
    } catch (parseError) {
      // If parsing fails, use original error message
      errorMessage = error.message || "Failed to fetch subscription details";
    }

    logger.error("Error fetching PayPal subscription details:", {
      subscriptionId,
      errorMessage,
      errorDetails,
      originalError: error.message,
    });

    // Create a more descriptive error
    const descriptiveError = new Error(errorMessage);
    descriptiveError.originalError = error;
    descriptiveError.details = errorDetails;
    throw descriptiveError;
  }
};

export const activatePayPalSubscription = async (
  subscriptionId,
  reason = "Activate subscription"
) => {
  try {
    const controller = getSubscriptionsController();
    await controller.activateSubscription({
      id: subscriptionId,
      body: { reason },
    });
  } catch (error) {
    // Parse PayPal SDK error response
    let errorMessage = "Unknown error";
    let errorDetails = {};

    try {
      if (error.response) {
        errorDetails = error.response.data || error.response.body || {};
        errorMessage = errorDetails.message || errorDetails.name || error.message || "Failed to activate subscription";
      } else if (error.body) {
        errorDetails = typeof error.body === "string" ? JSON.parse(error.body) : error.body;
        errorMessage = errorDetails.message || errorDetails.name || error.message || "Failed to activate subscription";
      } else if (error.message) {
        errorMessage = error.message;
      }

      if (errorDetails.details) {
        errorDetails.details.forEach((detail) => {
          if (detail.description) {
            errorMessage += `: ${detail.description}`;
          }
        });
      }
    } catch (parseError) {
      errorMessage = error.message || "Failed to activate subscription";
    }

    logger.error("Error activating PayPal subscription:", {
      subscriptionId,
      errorMessage,
      errorDetails,
      originalError: error.message,
    });

    const descriptiveError = new Error(errorMessage);
    descriptiveError.originalError = error;
    descriptiveError.details = errorDetails;
    throw descriptiveError;
  }
};

export const cancelPayPalSubscription = async (
  subscriptionId,
  reason = "User requested cancellation"
) => {
  const controller = getSubscriptionsController();
  await controller.cancelSubscription({
    id: subscriptionId,
    body: { reason },
  });
};

export const verifyPayPalWebhookSignature = async (headers, rawBody) => {
  if (!process.env.PAYPAL_WEBHOOK_ID) {
    throw new Error(
      "PAYPAL_WEBHOOK_ID is not configured. Cannot verify webhook."
    );
  }

  // Check if all required headers are present
  const requiredHeaders = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
  ];

  const missingHeaders = requiredHeaders.filter(
    (header) => !headers[header]
  );

  if (missingHeaders.length > 0) {
    throw new Error(
      `Missing required PayPal webhook headers: ${missingHeaders.join(", ")}`
    );
  }

  try {
    const token = await getAccessToken();
    const http = axios.create({
      baseURL: PAYPAL_BASE_URL,
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    // Ensure rawBody is a string (required for signature verification)
    const rawBodyString = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
    
    // Parse webhook event for verification
    let webhookEvent;
    try {
      webhookEvent = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    } catch (parseError) {
      logger.error("Failed to parse webhook event for verification:", {
        error: parseError.message,
      });
      throw new Error("Invalid webhook event format");
    }

    const payload = {
      auth_algo: headers["paypal-auth-algo"],
      cert_url: headers["paypal-cert-url"],
      transmission_id: headers["paypal-transmission-id"],
      transmission_sig: headers["paypal-transmission-sig"],
      transmission_time: headers["paypal-transmission-time"],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: webhookEvent,
    };

    const { data } = await http.post(
      "/v1/notifications/verify-webhook-signature",
      payload
    );

    if (data.verification_status !== "SUCCESS") {
      logger.warn("PayPal webhook signature verification failed", {
        verification_status: data.verification_status,
        verification_reason: data.verification_reason,
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        has_all_headers: !!(
          headers["paypal-auth-algo"] &&
          headers["paypal-cert-url"] &&
          headers["paypal-transmission-id"] &&
          headers["paypal-transmission-sig"] &&
          headers["paypal-transmission-time"]
        ),
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error verifying PayPal webhook signature:", {
      error: error.message,
      response: error.response?.data,
    });
    throw error;
  }
};

export const applyPlanToUserSubscription = async ({
  userId,
  plan,
  billingCycle,
  amount,
  currency,
  provider = "paypal",
  paypalInfo = {},
}) => {
  const periodEnd = calculatePeriodEnd(billingCycle);
  let subscription = await Subscription.findOne({ userId });

  if (subscription) {
    const preservedUsage = subscription.usage || createDefaultUsage();
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
    subscription.usage = preservedUsage;
    subscription.provider = provider;
    if (provider === "paypal") {
      subscription.paypalSubscriptionId =
        paypalInfo.subscriptionId || subscription.paypalSubscriptionId;
      subscription.paypalPlanId =
        paypalInfo.planId || subscription.paypalPlanId;
      subscription.paypalApprovalUrl =
        paypalInfo.approvalUrl || subscription.paypalApprovalUrl;
      subscription.stripeSubscriptionId = null;
    }
    await subscription.save();
  } else {
    const subscriptionData = createSubscriptionData(
      userId,
      plan._id,
      plan,
      billingCycle,
      amount,
      currency,
      plan.features,
      plan.features
    );
    subscriptionData.provider = provider;
    if (provider === "paypal") {
      subscriptionData.paypalSubscriptionId = paypalInfo.subscriptionId;
      subscriptionData.paypalPlanId = paypalInfo.planId;
      subscriptionData.paypalApprovalUrl = paypalInfo.approvalUrl;
    }
    subscription = new Subscription(subscriptionData);
    await subscription.save();
  }

  return subscription;
};
