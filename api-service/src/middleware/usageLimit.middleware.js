import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";
import ServiceUsage from "../models/serviceUsage.model.js";

// Threshold for unlimited limits (same as frontend)
const UNLIMITED_THRESHOLD = 99999999; // Any value >= 99,999,999 is considered unlimited

/**
 * Check if a limit value represents unlimited
 * @param {number} limit - The limit value to check
 * @returns {boolean} - True if limit is unlimited
 */
const isUnlimited = (limit) => {
  if (!limit || limit === 0) return false;
  return limit >= UNLIMITED_THRESHOLD;
};

// Check if user has access to a specific service
export const checkServiceAccess = (serviceName) => {
  return asyncHandler(async (req, res, next) => {
    const userId = req.user._id;

    // Get user's subscription
    const subscription = await Subscription.findOne({ userId }).populate(
      "planId",
      "features"
    );

    // Check if user has access
    let hasAccess = false;
    let limits = {};

    if (subscription && subscription.isActive()) {
      // Check subscription access
      const plan = subscription.planId;
      if (plan && plan.features[serviceName]?.enabled) {
        hasAccess = true;
        limits = plan.features[serviceName];
      }
    }

    // Fallback to free plan if no subscription or feature not enabled
    if (!hasAccess) {
      const freePlan = await SubscriptionPlan.findOne({
        type: "free",
        status: "active",
      });

      if (freePlan && freePlan.features[serviceName]?.enabled) {
        hasAccess = true;
        limits = freePlan.features[serviceName];
      }
    }

    if (!hasAccess) {
      throw new ApiError(
        403,
        `Access to ${serviceName} service is not available in your current plan`
      );
    }

    // Attach limits to request
    req.serviceLimits = limits;
    req.subscription = subscription;

    next();
  });
};

// Check daily usage limits for a service
export const checkDailyUsageLimit = (serviceName, limitType) => {
  return asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const limits = req.serviceLimits;

    if (!limits || !limits[limitType]) {
      throw new ApiError(
        403,
        `No ${limitType} limit defined for ${serviceName}`
      );
    }

    const dailyLimit = limits[limitType];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's usage
    const todayUsage = await ServiceUsage.aggregate([
      {
        $match: {
          userId: userId,
          "request.type": serviceName,
          "request.timestamp": { $gte: today },
          "response.success": true,
        },
      },
      {
        $group: {
          _id: null,
          totalUsage: { $sum: `$response.data.${limitType}` },
        },
      },
    ]);

    const usedToday = todayUsage[0]?.totalUsage || 0;

    // Skip limit check if unlimited plan
    if (!isUnlimited(dailyLimit)) {
      if (usedToday >= dailyLimit) {
        throw new ApiError(
          403,
          `Daily ${limitType} limit reached (${dailyLimit} ${limitType}/day)`
        );
      }
    }

    // Attach usage info to request
    req.usageInfo = {
      usedToday: usedToday,
      dailyLimit: dailyLimit,
      remaining: isUnlimited(dailyLimit) ? Infinity : dailyLimit - usedToday,
      isUnlimited: isUnlimited(dailyLimit),
    };

    next();
  });
};

// Check if user can use AI Text Writer
export const checkTextWriterAccess = [
  checkServiceAccess("aiTextWriter"),
  checkDailyUsageLimit("ai_text_writer", "wordsGenerated"),
];

// Check if user can use AI Image Generator
export const checkImageGeneratorAccess = [
  checkServiceAccess("aiImageGenerator"),
  checkDailyUsageLimit("ai_image_generator", "imagesGenerated"),
];

// Check if user can use AI Search
export const checkSearchAccess = [
  checkServiceAccess("aiSearch"),
  checkDailyUsageLimit("ai_search", "searchesPerDay"),
];

// Check if user can use AI Chatbot
export const checkChatbotAccess = [
  checkServiceAccess("aiChatbot"),
  checkDailyUsageLimit("ai_chatbot", "messagesGenerated"),
];

// Generic usage limit checker
export const checkUsageLimit = (serviceName, limitType, limitValue) => {
  return asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's usage
    const todayUsage = await ServiceUsage.aggregate([
      {
        $match: {
          userId: userId,
          "request.type": serviceName,
          "request.timestamp": { $gte: today },
          "response.success": true,
        },
      },
      {
        $group: {
          _id: null,
          totalUsage: { $sum: `$response.data.${limitType}` },
        },
      },
    ]);

    const usedToday = todayUsage[0]?.totalUsage || 0;

    // Skip limit check if unlimited plan
    if (!isUnlimited(limitValue)) {
      if (usedToday >= limitValue) {
        throw new ApiError(
          403,
          `Daily ${limitType} limit reached (${limitValue} ${limitType}/day)`
        );
      }
    }

    req.usageInfo = {
      usedToday: usedToday,
      dailyLimit: limitValue,
      remaining: isUnlimited(limitValue) ? Infinity : limitValue - usedToday,
      isUnlimited: isUnlimited(limitValue),
    };

    next();
  });
};

// Check subscription status
export const checkSubscriptionStatus = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  // Get user's subscription
  const subscription = await Subscription.findOne({ userId });

  // Check if user has any active access
  const hasActiveSubscription = subscription && subscription.isActive();

  if (!hasActiveSubscription) {
    throw new ApiError(
      403,
      "No active subscription found. Please subscribe to a plan."
    );
  }

  req.subscription = subscription;
  req.hasActiveAccess = hasActiveSubscription;

  next();
});
