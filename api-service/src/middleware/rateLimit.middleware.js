import rateLimit from "express-rate-limit";
import Subscription from "../models/subscription.model.js";
import { getRateLimitConfig, isFreePlan } from "../utils/chatbotLimits.js";

/**
 * Rate limiter for chatbot query endpoints
 * Plan-based rate limiting: Free plan = 10/hour, Paid plans = based on plan
 * Disabled in development mode (NODE_ENV !== production)
 */
export const chatbotQueryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: async (req) => {
    // Skip rate limiting in development mode
    if (process.env.NODE_ENV !== "production") {
      return 1000; // Unlimited in dev
    }

    // Get user's subscription plan
    try {
      const userId = req.user?._id;
      if (!userId) return 10; // Default limit for unauthenticated

      const subscription = await Subscription.findOne({ userId }).populate(
        "planId"
      );
      const plan = subscription?.planId || {};
      const config = getRateLimitConfig(plan);

      // Return queries per minute (from hourly limit)
      return Math.max(1, Math.floor(config.query.max / 60));
    } catch (error) {
      return 10; // Default limit on error
    }
  },
  message: "Too many chatbot queries. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development mode
    return process.env.NODE_ENV !== "production";
  },
});

/**
 * Rate limiter for chatbot training endpoints
 * Plan-based rate limiting: Free plan = 10/hour, Paid plans = based on plan
 * Disabled in development mode
 */
export const chatbotTrainingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => {
    // Skip rate limiting in development mode
    if (process.env.NODE_ENV !== "production") {
      return 1000; // Unlimited in dev
    }

    // Get user's subscription plan
    try {
      const userId = req.user?._id;
      if (!userId) return 10; // Default limit for unauthenticated

      const subscription = await Subscription.findOne({ userId }).populate(
        "planId"
      );
      const plan = subscription?.planId || {};
      const config = getRateLimitConfig(plan);

      return config.training.max; // 10/hour for free, more for paid
    } catch (error) {
      return 10; // Default limit on error
    }
  },
  message: "Too many training requests. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV !== "production";
  },
});

/**
 * Rate limiter for widget query endpoint (public)
 * Only enabled in production mode
 */
export const widgetQueryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === "production" ? 20 : 1000, // 20 queries/min per IP in production
  message: "Too many widget queries. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV !== "production";
  },
});
