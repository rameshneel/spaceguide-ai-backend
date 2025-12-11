import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Subscription from "../models/subscription.model.js";
import User from "../models/user.model.js";

// Get subscription status with real-time updates
export const getSubscriptionStatus = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const subscription = await Subscription.findOne({ userId }).populate(
    "planId",
    "name displayName type features price"
  );

  const isActive = subscription && subscription.isActive();

  // Emit subscription status update
  if (req.socketIO) {
    req.socketIO.emitToUser(userId, "subscription_status_update", {
      subscription: subscription
        ? {
            id: subscription._id,
            plan: subscription.plan,
            planDetails: subscription.planId,
            status: subscription.status,
            isActive: isActive,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
      hasActiveAccess: isActive,
      timestamp: new Date(),
    });
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        subscription: subscription
          ? {
              id: subscription._id,
              plan: subscription.plan,
              planDetails: subscription.planId,
              status: subscription.status,
              isActive: isActive,
              currentPeriodEnd: subscription.currentPeriodEnd,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            }
          : null,
        hasActiveAccess: isActive,
      },
      "Subscription status retrieved successfully"
    )
  );
});

// Send upgrade prompt notification
export const sendUpgradePrompt = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { reason, service } = req.body;

  if (!req.socketIO) {
    throw new ApiError(503, "Socket.IO service not available");
  }

  const subscription = await Subscription.findOne({ userId }).populate(
    "planId",
    "name displayName type"
  );

  let message = "";
  let urgency = "info";

  switch (reason) {
    case "limit_reached":
      message = `🚫 You've reached your ${service} limit. Upgrade to continue using our AI services.`;
      urgency = "warning";
      break;
    case "feature_unavailable":
      message =
        "🔒 This feature is not available in your current plan. Upgrade to unlock it.";
      urgency = "info";
      break;
    default:
      message =
        "💡 Upgrade your plan to unlock more features and higher limits.";
      urgency = "info";
  }

  req.socketIO.emitToUser(userId, "upgrade_prompt", {
    reason: reason,
    service: service,
    message: message,
    urgency: urgency,
    currentPlan: subscription?.plan || "free",
    upgradeUrl: "/subscription/plans",
    timestamp: new Date(),
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        message: "Upgrade prompt sent successfully",
        reason: reason,
        service: service,
      },
      "Upgrade prompt notification sent"
    )
  );
});
