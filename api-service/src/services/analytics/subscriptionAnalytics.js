import Subscription from "../../models/subscription.model.js";
import ServiceUsage from "../../models/serviceUsage.model.js";
import User from "../../models/user.model.js";

// Subscription Analytics Service
export class SubscriptionAnalyticsService {
  // Get subscription metrics
  async getSubscriptionMetrics() {
    const totalSubscriptions = await Subscription.countDocuments();
    const activeSubscriptions = await Subscription.countDocuments({
      status: "active",
    });
    const cancelledSubscriptions = await Subscription.countDocuments({
      status: "cancelled",
    });
    const expiredSubscriptions = await Subscription.countDocuments({
      status: "expired",
    });

    return {
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        cancelled: cancelledSubscriptions,
        expired: expiredSubscriptions,
        activeRate:
          totalSubscriptions > 0
            ? (activeSubscriptions / totalSubscriptions) * 100
            : 0,
      },
    };
  }

  // Get plan distribution
  async getPlanDistribution() {
    const planStats = await Subscription.aggregate([
      {
        $group: {
          _id: "$plan",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$amount" },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    return planStats;
  }

  // Get revenue metrics
  async getRevenueMetrics(period = "month") {
    const now = new Date();
    let startDate;

    switch (period) {
      case "day":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const revenueStats = await Subscription.aggregate([
      {
        $match: {
          status: "active",
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          averageRevenue: { $avg: "$amount" },
          subscriptionCount: { $sum: 1 },
        },
      },
    ]);

    return (
      revenueStats[0] || {
        totalRevenue: 0,
        averageRevenue: 0,
        subscriptionCount: 0,
      }
    );
  }

  // Get usage analytics
  async getUsageAnalytics(service = null) {
    const matchStage = service ? { "request.type": service } : {};

    const usageStats = await ServiceUsage.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$request.type",
          totalRequests: { $sum: 1 },
          successfulRequests: {
            $sum: { $cond: ["$response.success", 1, 0] },
          },
          totalWords: { $sum: "$response.data.wordsGenerated" },
          totalImages: { $sum: "$response.data.imagesGenerated" },
          averageResponseTime: { $avg: "$response.responseTime" },
        },
      },
      {
        $sort: { totalRequests: -1 },
      },
    ]);

    return usageStats;
  }

  // Get user engagement metrics
  async getUserEngagementMetrics() {
    const totalUsers = await User.countDocuments();

    // Get active users from ServiceUsage (users who used services in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUserIds = await ServiceUsage.distinct("userId", {
      "request.timestamp": {
        $gte: thirtyDaysAgo,
      },
    });
    const activeUsers = activeUserIds.length;

    const subscriptionUsers = await Subscription.countDocuments({
      status: "active",
    });
    return {
      totalUsers,
      activeUsers,
      subscriptionUsers,
      engagementRate: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
      subscriptionRate:
        totalUsers > 0 ? (subscriptionUsers / totalUsers) * 100 : 0,
    };
  }

  // Get churn analysis
  async getChurnAnalysis() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const churnedUsers = await Subscription.countDocuments({
      status: "cancelled",
      updatedAt: { $gte: thirtyDaysAgo },
    });

    const totalActiveUsers = await Subscription.countDocuments({
      status: "active",
    });

    const churnRate =
      totalActiveUsers > 0 ? (churnedUsers / totalActiveUsers) * 100 : 0;

    return {
      churnedUsers,
      totalActiveUsers,
      churnRate,
      period: "30 days",
    };
  }

  // Get comprehensive dashboard data
  async getDashboardData() {
    const [
      subscriptionMetrics,
      planDistribution,
      revenueMetrics,
      usageAnalytics,
      userEngagement,
      churnAnalysis,
    ] = await Promise.all([
      this.getSubscriptionMetrics(),
      this.getPlanDistribution(),
      this.getRevenueMetrics("month"),
      this.getUsageAnalytics(),
      this.getUserEngagementMetrics(),
      this.getChurnAnalysis(),
    ]);

    return {
      subscriptionMetrics,
      planDistribution,
      revenueMetrics,
      usageAnalytics,
      userEngagement,
      churnAnalysis,
      generatedAt: new Date(),
    };
  }
}

export const subscriptionAnalyticsService = new SubscriptionAnalyticsService();
