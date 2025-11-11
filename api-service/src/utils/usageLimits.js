import ServiceUsage from "../models/serviceUsage.model.js";
import {
  USAGE_WARNING_THRESHOLD,
  USAGE_CRITICAL_THRESHOLD,
} from "../constants/index.js";

/**
 * Check usage limits for a service
 * @param {Object} params - Parameters
 * @param {string} params.userId - User ID
 * @param {Object} params.serviceId - Service ID (MongoDB ObjectId)
 * @param {string} params.limitType - Type of limit ('words' or 'images')
 * @param {number} params.currentUsage - Current usage today
 * @param {number} params.maxLimit - Maximum allowed limit
 * @param {number} [params.estimatedUsage] - Estimated usage for this request (optional)
 * @param {Object} [params.socketIO] - Socket.IO instance for real-time events (optional)
 * @param {string} [params.serviceName] - Service name for events (optional)
 * @returns {Object} - Usage check result
 */
export const checkUsageLimits = async ({
  userId,
  serviceId,
  limitType,
  currentUsage,
  maxLimit,
  estimatedUsage = 0,
  socketIO = null,
  serviceName = "service",
}) => {
  const usagePercentage = Math.round((currentUsage / maxLimit) * 100);
  const totalAfterGeneration = currentUsage + estimatedUsage;
  const remaining = maxLimit - currentUsage;

  // Check if limit already exceeded
  if (currentUsage >= maxLimit) {
    // Emit limit exceeded event
    if (socketIO) {
      socketIO.emitToUser(userId, "usage_limit_exceeded", {
        service: serviceName,
        usage: {
          used: currentUsage,
          limit: maxLimit,
          percentage: usagePercentage,
          remaining: 0,
        },
        message: `🚫 Daily ${limitType} limit reached (${maxLimit} ${limitType}). Please upgrade your plan or try again tomorrow.`,
        timestamp: new Date(),
      });
    }

    return {
      allowed: false,
      reason: "limit_exceeded",
      message: `Daily ${limitType} limit reached (${maxLimit} ${limitType} used). Please upgrade your plan or try again tomorrow.`,
      usage: {
        used: currentUsage,
        limit: maxLimit,
        percentage: usagePercentage,
        remaining: 0,
      },
    };
  }

  // Check if estimated usage will exceed limit
  if (estimatedUsage > 0 && totalAfterGeneration > maxLimit) {
    // Emit warning event
    if (socketIO) {
      socketIO.emitToUser(userId, "usage_limit_warning", {
        service: serviceName,
        usage: {
          used: currentUsage,
          limit: maxLimit,
          percentage: usagePercentage,
          remaining: remaining,
          estimated: estimatedUsage,
        },
        message: `⚠️ Warning: This request may exceed your daily limit. Only ${remaining} ${limitType} remaining.`,
        timestamp: new Date(),
      });
    }

    return {
      allowed: false,
      reason: "insufficient_remaining",
      message: `Insufficient ${limitType} remaining (${remaining} ${limitType} left). Estimated request: ${estimatedUsage} ${limitType}. Please reduce content length or upgrade your plan.`,
      usage: {
        used: currentUsage,
        limit: maxLimit,
        remaining: remaining,
        estimated: estimatedUsage,
      },
    };
  }

  // Check if approaching limit (80% threshold)
  if (usagePercentage >= USAGE_WARNING_THRESHOLD && socketIO) {
    socketIO.emitToUser(userId, "usage_warning", {
      service: serviceName,
      usage: {
        used: currentUsage,
        limit: maxLimit,
        percentage: usagePercentage,
        remaining: remaining,
      },
      message:
        usagePercentage >= USAGE_CRITICAL_THRESHOLD
          ? `⚠️ You've used ${usagePercentage}% of your daily limit!`
          : `📊 You've used ${usagePercentage}% of your daily limit.`,
      timestamp: new Date(),
    });
  }

  return {
    allowed: true,
    usage: {
      used: currentUsage,
      limit: maxLimit,
      percentage: usagePercentage,
      remaining: remaining,
    },
  };
};

/**
 * Get today's usage for a service
 * @param {string} userId - User ID
 * @param {Object} serviceId - Service ID (MongoDB ObjectId)
 * @param {string} usageField - Field to sum (e.g., 'wordsGenerated', 'imagesGenerated')
 * @returns {Promise<{total: number, requests: number}>}
 */
export const getTodayUsage = async (userId, serviceId, usageField) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await ServiceUsage.aggregate([
    {
      $match: {
        userId: userId,
        serviceId: serviceId,
        "request.timestamp": { $gte: today },
        "response.success": true,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: `$response.data.${usageField}` },
        requests: { $sum: 1 },
      },
    },
  ]);

  return {
    total: result[0]?.total || 0,
    requests: result[0]?.requests || 0,
  };
};
