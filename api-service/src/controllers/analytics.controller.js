import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { subscriptionAnalyticsService } from "../services/analytics/subscriptionAnalytics.js";

// Get subscription analytics dashboard
export const getSubscriptionDashboard = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required");
  }

  const dashboardData = await subscriptionAnalyticsService.getDashboardData();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        dashboardData,
        "Subscription analytics dashboard retrieved successfully"
      )
    );
});

// Get subscription metrics
export const getSubscriptionMetrics = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required");
  }

  const metrics = await subscriptionAnalyticsService.getSubscriptionMetrics();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        metrics,
        "Subscription metrics retrieved successfully"
      )
    );
});

// Get plan distribution
export const getPlanDistribution = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required");
  }

  const distribution = await subscriptionAnalyticsService.getPlanDistribution();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { distribution },
        "Plan distribution retrieved successfully"
      )
    );
});

// Get revenue metrics
export const getRevenueMetrics = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required");
  }

  const { period = "month" } = req.query;
  const revenue = await subscriptionAnalyticsService.getRevenueMetrics(period);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { revenue, period },
        "Revenue metrics retrieved successfully"
      )
    );
});

// Get usage analytics
export const getUsageAnalytics = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required");
  }

  const { service } = req.query;
  const analytics = await subscriptionAnalyticsService.getUsageAnalytics(
    service
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { analytics, service: service || "all" },
        "Usage analytics retrieved successfully"
      )
    );
});

// Get user engagement metrics
export const getUserEngagementMetrics = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required");
  }

  const engagement =
    await subscriptionAnalyticsService.getUserEngagementMetrics();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        engagement,
        "User engagement metrics retrieved successfully"
      )
    );
});

// Get churn analysis
export const getChurnAnalysis = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required");
  }

  const churn = await subscriptionAnalyticsService.getChurnAnalysis();

  return res
    .status(200)
    .json(new ApiResponse(200, churn, "Churn analysis retrieved successfully"));
});
