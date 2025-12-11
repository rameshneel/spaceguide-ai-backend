import rateLimit from "express-rate-limit";
import Subscription from "../models/subscription.model.js";
import { getRateLimitConfig, isFreePlan } from "../utils/chatbotLimits.js";

/**
 * Rate limiter for chatbot query endpoints
 * Plan-based rate limiting: Free plan = 10/hour, Paid plans = based on plan
 */
export const chatbotQueryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: async (req) => {
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
  skip: () => false,
});

/**
 * Rate limiter for chatbot training endpoints
 * Plan-based rate limiting: Free plan = 10/hour, Paid plans = based on plan
 */
export const chatbotTrainingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => {
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
  skip: () => false,
});

/**
 * Rate limiter for widget query endpoint (public)
 * Enabled with fixed limit
 */
export const widgetQueryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 queries/min per IP
  message: "Too many widget queries. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => false,
});
