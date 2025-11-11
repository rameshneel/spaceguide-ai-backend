import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import Subscription from "../models/subscription.model.js";
import ServiceUsage from "../models/serviceUsage.model.js";

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

    if (usedToday >= dailyLimit) {
      throw new ApiError(
        403,
        `Daily ${limitType} limit reached (${dailyLimit} ${limitType}/day)`
      );
    }

    // Attach usage info to request
    req.usageInfo = {
      usedToday: usedToday,
      dailyLimit: dailyLimit,
      remaining: dailyLimit - usedToday,
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
  checkDailyUsageLimit("ai_search", "searchesPerformed"),
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

    if (usedToday >= limitValue) {
      throw new ApiError(
        403,
        `Daily ${limitType} limit reached (${limitValue} ${limitType}/day)`
      );
    }

    req.usageInfo = {
      usedToday: usedToday,
      dailyLimit: limitValue,
      remaining: limitValue - usedToday,
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
