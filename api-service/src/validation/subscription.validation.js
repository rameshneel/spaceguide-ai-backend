import { body, param, query } from "express-validator";

// Subscription validation middleware
export const validateSubscriptionUpgrade = [
  body("planId")
    .notEmpty()
    .withMessage("Plan ID is required")
    // Allow both MongoDB ObjectId and plan type strings (e.g., "basic", "pro")
    // Controller will handle the lookup logic
    .isString()
    .withMessage("Plan ID must be a string"),

  body("billingCycle")
    .optional()
    .isIn(["monthly", "yearly"])
    .withMessage("Billing cycle must be either 'monthly' or 'yearly'"),
];

export const validateSubscriptionCancel = [
  // No additional validation needed for cancellation
  // Business logic handles active subscription check
];

export const validateUsageQuery = [
  query("service")
    .optional()
    .isIn(["ai_text_writer", "ai_image_generator", "ai_search", "ai_chatbot"])
    .withMessage("Invalid service type"),

  query("period")
    .optional()
    .isIn(["today", "week", "month", "year"])
    .withMessage("Invalid period type"),
];

export const validateUpgradePrompt = [
  body("reason")
    .notEmpty()
    .withMessage("Reason is required")
    .isIn(["limit_reached", "feature_unavailable", "general"])
    .withMessage("Invalid reason type"),

  body("service")
    .optional()
    .isIn(["ai_text_writer", "ai_image_generator", "ai_search", "ai_chatbot"])
    .withMessage("Invalid service type"),
];

export const validatePlanId = [
  param("planId").isMongoId().withMessage("Invalid plan ID format"),
];

export const validateSubscriptionQuery = [
  query("status")
    .optional()
    .isIn(["active", "inactive", "cancelled", "expired", "pending"])
    .withMessage("Invalid subscription status"),

  query("plan")
    .optional()
    .isIn(["free", "basic", "pro", "enterprise"])
    .withMessage("Invalid plan type"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];
