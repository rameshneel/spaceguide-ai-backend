/**
 * Chatbot Limits Utility
 * Determines limits based on user's subscription plan
 * Free Plan = Development Mode limits
 * Paid Plans = Production Mode limits
 */

/**
 * Check if user has free plan
 */
export const isFreePlan = (planType) => {
  return planType === "free" || !planType;
};

/**
 * Get chatbot limits based on plan
 * @param {Object} plan - Subscription plan object
 * @returns {Object} Limits object
 */
export const getChatbotLimits = (plan) => {
  const planType = plan?.type || "free";

  // Free Plan = Development Mode
  if (isFreePlan(planType)) {
    return {
      chatbotsPerAccount: 1,
      maxPdfFiles: 3,
      maxTotalPdfSize: 10 * 1024 * 1024, // 10MB total
      maxFileSize: 10 * 1024 * 1024, // 10MB per file
      queriesPerHour: 10,
      queriesPerDay: 20,
      messagesPerDay: 20,
      template: "single", // Only 1 template allowed
    };
  }

  // Paid Plans = Production Mode (from plan features)
  const aiChatbot = plan?.features?.aiChatbot || {};

  return {
    chatbotsPerAccount: aiChatbot.chatbotsPerAccount || 5,
    maxPdfFiles: 999999999, // Unlimited for paid
    maxTotalPdfSize: 999999999 * 1024 * 1024, // Unlimited
    maxFileSize: 10 * 1024 * 1024, // 10MB per file (can be increased)
    queriesPerHour: Math.floor((aiChatbot.messagesPerDay || 1000) / 24), // Pro-rated hourly
    queriesPerDay: aiChatbot.messagesPerDay || 1000,
    messagesPerDay: aiChatbot.messagesPerDay || 1000,
    template: "multiple", // Multiple templates allowed
  };
};

/**
 * Get plan-based rate limit
 * @param {Object} plan - Subscription plan object
 * @returns {Object} Rate limit config
 */
export const getRateLimitConfig = (plan) => {
  const limits = getChatbotLimits(plan);

  return {
    // Training: 10/hour for free, more for paid
    training: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: limits.queriesPerHour,
    },
    // Query: Based on plan
    query: {
      windowMs: 60 * 1000, // 1 minute
      max: Math.max(10, Math.floor(limits.queriesPerHour / 60)), // At least 10/min
    },
  };
};
