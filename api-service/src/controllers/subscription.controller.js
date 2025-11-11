import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";
import User from "../models/user.model.js";
import ServiceUsage from "../models/serviceUsage.model.js";
import Service from "../models/service.model.js";
import {
  createDefaultUsage,
  createSubscriptionData,
  calculatePeriodEnd,
} from "../utils/subscriptionUtils.js";
import logger from "../utils/logger.js";

// ========================================
// SUBSCRIPTION MANAGEMENT
// ========================================

// Get all available subscription plans
export const getSubscriptionPlans = asyncHandler(async (req, res) => {
  const plans = await SubscriptionPlan.getActivePlans();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        plans: plans.map((plan) => ({
          id: plan._id,
          name: plan.name,
          displayName: plan.displayName,
          description: plan.description,
          price: plan.price,
          type: plan.type,
          features: plan.features,
          isPopular: plan.isPopular,
          displayOrder: plan.displayOrder,
        })),
        totalPlans: plans.length,
      },
      "Subscription plans retrieved successfully"
    )
  );
});

// Get user's current subscription
export const getCurrentSubscription = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  let subscription = await Subscription.findOne({ userId })
    .populate("planId", "name displayName type features price")
    .sort({ createdAt: -1 });

  // Auto-create free subscription if user doesn't have one
  if (!subscription) {
    logger.info(
      "🆕 No subscription found in getCurrentSubscription, creating free plan for user:",
      userId
    );

    // Get free plan
    const freePlan = await SubscriptionPlan.findOne({
      type: "free",
      status: "active",
    });

    if (!freePlan) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            subscription: null,
            hasActiveSubscription: false,
            message: "No active subscription found. Free plan not available.",
          },
          "User subscription status retrieved"
        )
      );
    }

    // Create free subscription
    const subscriptionData = createSubscriptionData(
      userId,
      freePlan._id,
      freePlan,
      "monthly",
      0,
      freePlan.price.currency || "USD",
      freePlan.features,
      freePlan.features
    );

    subscription = new Subscription(subscriptionData);
    await subscription.save();

    // Populate planId
    subscription = await Subscription.findById(subscription._id).populate(
      "planId",
      "name displayName type features price"
    );

    logger.info(
      "✅ Free subscription created in getCurrentSubscription for user:",
      userId
    );
  }

  const isActive = subscription.isActive();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        subscription: {
          id: subscription._id,
          plan: subscription.plan,
          planDetails: subscription.planId,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          amount: subscription.amount,
          currency: subscription.currency,
          limits: subscription.limits,
          features: subscription.features,
          usage: subscription.usage,
          isActive: isActive,
        },
        hasActiveSubscription: isActive,
      },
      "User subscription retrieved successfully"
    )
  );
});

// Upgrade to paid subscription
export const upgradeSubscription = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { planId, billingCycle = "monthly" } = req.body;

  if (!planId) {
    throw new ApiError(400, "Plan ID is required");
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
    throw new ApiError(400, "Cannot upgrade to free plan");
  }

  // Check if user has an existing subscription
  const existingSubscription = await Subscription.findOne({ userId });

  // If user has an active subscription with the same plan and billing cycle, inform them
  if (
    existingSubscription &&
    existingSubscription.isActive() &&
    existingSubscription.planId?.toString() === plan._id.toString() &&
    existingSubscription.billingCycle === billingCycle
  ) {
    throw new ApiError(
      400,
      "You already have an active subscription to this plan with the same billing cycle"
    );
  }

  // Calculate pricing and period
  const amount =
    billingCycle === "yearly" ? plan.price.yearly : plan.price.monthly;
  const currency = plan.price.currency;
  const periodEnd = calculatePeriodEnd(billingCycle);

  // Create or update subscription
  let subscription;
  if (existingSubscription) {
    // Update existing subscription (upgrade/downgrade/change billing cycle)
    // Preserve usage data if upgrading (don't reset usage)
    const preserveUsage = existingSubscription.usage || createDefaultUsage();

    subscription = await Subscription.findByIdAndUpdate(
      existingSubscription._id,
      {
        planId: plan._id,
        plan: plan.type,
        status: "active",
        billingCycle: billingCycle,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        amount: amount,
        currency: currency,
        limits: plan.features,
        features: plan.features,
        usage: preserveUsage, // Preserve existing usage data
      },
      { new: true }
    );
  } else {
    // Create new subscription
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

    subscription = new Subscription(subscriptionData);
    await subscription.save();
  }

  // Emit subscription upgrade event
  if (req.socketIO) {
    req.socketIO.emitToUser(userId, "subscription_upgraded", {
      subscription: {
        id: subscription._id,
        plan: subscription.plan,
        planDetails: plan,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        amount: subscription.amount,
        currency: subscription.currency,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
      timestamp: new Date(),
    });
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        subscription: {
          id: subscription._id,
          plan: subscription.plan,
          planDetails: plan,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          amount: subscription.amount,
          currency: subscription.currency,
          limits: subscription.limits,
          features: subscription.features,
        },
      },
      "Subscription upgraded successfully"
    )
  );
});

// Cancel subscription
export const cancelSubscription = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const subscription = await Subscription.findOne({ userId });
  if (!subscription) {
    throw new ApiError(404, "No active subscription found");
  }

  if (!subscription.isActive()) {
    throw new ApiError(400, "Subscription is not active");
  }

  // Set to cancel at period end
  subscription.cancelAtPeriodEnd = true;
  await subscription.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        subscription: {
          id: subscription._id,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
      },
      "Subscription will be cancelled at the end of the current period"
    )
  );
});

// Get subscription usage
export const getSubscriptionUsage = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  let subscription = await Subscription.findOne({ userId }).populate(
    "planId",
    "name displayName features"
  );

  // Auto-create free subscription if user doesn't have one
  if (!subscription) {
    logger.info(
      "🆕 No subscription found, creating free plan for user:",
      userId
    );

    // Get free plan
    const freePlan = await SubscriptionPlan.findOne({
      type: "free",
      status: "active",
    });

    if (!freePlan) {
      throw new ApiError(404, "Free plan not found. Please contact support.");
    }

    // Create free subscription
    const subscriptionData = createSubscriptionData(
      userId,
      freePlan._id,
      freePlan,
      "monthly", // Free plan doesn't really have billing cycle
      0, // Free plan amount
      freePlan.price.currency || "USD",
      freePlan.features,
      freePlan.features
    );

    subscription = new Subscription(subscriptionData);
    await subscription.save();

    // Populate planId
    subscription = await Subscription.findById(subscription._id).populate(
      "planId",
      "name displayName features"
    );

    logger.info("✅ Free subscription created for user:", userId);
  }

  const plan = subscription.planId;
  const limits = subscription.limits;

  // Get today's date for filtering
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get AI Text Writer service
  const textWriterService = await Service.findOne({ type: "ai_text_writer" });

  // Calculate real-time usage from ServiceUsage for AI Text Writer
  let wordsUsedToday = 0;
  let requestsUsedToday = 0;

  if (textWriterService) {
    const todayTextUsage = await ServiceUsage.aggregate([
      {
        $match: {
          userId: userId,
          serviceId: textWriterService._id,
          "request.timestamp": { $gte: today },
          "response.success": true,
        },
      },
      {
        $group: {
          _id: null,
          totalWords: { $sum: "$response.data.wordsGenerated" },
          totalRequests: { $sum: 1 },
        },
      },
    ]);

    wordsUsedToday = todayTextUsage[0]?.totalWords || 0;
    requestsUsedToday = todayTextUsage[0]?.totalRequests || 0;
  }

  // Get AI Image Generator service (if exists)
  const imageService = await Service.findOne({ type: "ai_image_generator" });
  let imagesUsedToday = 0;

  if (imageService) {
    const todayImageUsage = await ServiceUsage.aggregate([
      {
        $match: {
          userId: userId,
          serviceId: imageService._id,
          "request.timestamp": { $gte: today },
          "response.success": true,
        },
      },
      {
        $group: {
          _id: null,
          totalImages: { $sum: "$response.data.imagesGenerated" },
        },
      },
    ]);

    imagesUsedToday = todayImageUsage[0]?.totalImages || 0;
  }

  // Get chatbots count
  const usage = subscription.usage || {};
  const chatbotsUsed = usage.chatbotsUsed || 0;

  // Calculate usage percentages
  const usageStats = {
    aiTextWriter: {
      wordsUsed: wordsUsedToday,
      wordsLimit: limits.aiTextWriter?.wordsPerDay || 0,
      wordsPercentage: limits.aiTextWriter?.wordsPerDay
        ? Math.round((wordsUsedToday / limits.aiTextWriter.wordsPerDay) * 100)
        : 0,
      requestsUsed: requestsUsedToday,
      requestsLimit: limits.aiTextWriter?.requestsPerDay || 0,
    },
    aiImageGenerator: {
      imagesUsed: imagesUsedToday,
      imagesLimit: limits.aiImageGenerator?.imagesPerDay || 0,
      imagesPercentage: limits.aiImageGenerator?.imagesPerDay
        ? Math.round(
            (imagesUsedToday / limits.aiImageGenerator.imagesPerDay) * 100
          )
        : 0,
    },
    aiSearch: {
      searchesUsed: 0, // This would need to be tracked separately
      searchesLimit: limits.aiSearch?.searchesPerDay || 0,
      searchesPercentage: limits.aiSearch?.searchesPerDay
        ? Math.round((0 / limits.aiSearch.searchesPerDay) * 100)
        : 0,
    },
    aiChatbot: {
      chatbotsUsed: chatbotsUsed,
      chatbotsLimit: limits.aiChatbot?.chatbotsPerAccount || 0,
      chatbotsPercentage: limits.aiChatbot?.chatbotsPerAccount
        ? Math.round((chatbotsUsed / limits.aiChatbot.chatbotsPerAccount) * 100)
        : 0,
    },
  };

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        subscription: {
          id: subscription._id,
          plan: subscription.plan,
          planDetails: plan,
          status: subscription.status,
          isActive: subscription.isActive(),
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
        usage: usageStats,
        lastResetDate:
          usage.lastResetDate || subscription.createdAt || new Date(),
        nextResetDate: (() => {
          const resetDate = new Date(
            usage.lastResetDate || subscription.createdAt || new Date()
          );
          resetDate.setDate(resetDate.getDate() + 1);
          resetDate.setHours(0, 0, 0, 0);
          return resetDate;
        })(),
      },
      "Subscription usage retrieved successfully"
    )
  );
});

// Admin: Get all subscriptions
export const getAllSubscriptions = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required");
  }

  const { page = 1, limit = 10, status, plan } = req.query;
  const skip = (page - 1) * limit;

  const filter = {};
  if (status) filter.status = status;
  if (plan) filter.plan = plan;

  const subscriptions = await Subscription.find(filter)
    .populate("userId", "firstName lastName email")
    .populate("planId", "name displayName type")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Subscription.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        subscriptions: subscriptions.map((sub) => ({
          id: sub._id,
          user: sub.userId,
          plan: sub.plan,
          planDetails: sub.planId,
          status: sub.status,
          billingCycle: sub.billingCycle,
          amount: sub.amount,
          currency: sub.currency,
          currentPeriodEnd: sub.currentPeriodEnd,
          createdAt: sub.createdAt,
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalSubscriptions: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
      "All subscriptions retrieved successfully"
    )
  );
});
