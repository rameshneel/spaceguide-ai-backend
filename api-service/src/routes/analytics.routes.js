import express from "express";
import {
  getSubscriptionDashboard,
  getSubscriptionMetrics,
  getPlanDistribution,
  getRevenueMetrics,
  getUsageAnalytics,
  getUserEngagementMetrics,
  getChurnAnalysis,
} from "../controllers/analytics.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { adminOnly } from "../middleware/role.middleware.js";

const router = express.Router();

// ========================================
// ANALYTICS ROUTES (Admin Only)
// ========================================

// Get comprehensive analytics dashboard
router.get("/dashboard", verifyJWT, adminOnly, getSubscriptionDashboard);

// Get subscription metrics
router.get("/subscriptions", verifyJWT, adminOnly, getSubscriptionMetrics);

// Get plan distribution
router.get("/plans", verifyJWT, adminOnly, getPlanDistribution);

// Get revenue metrics
router.get("/revenue", verifyJWT, adminOnly, getRevenueMetrics);

// Get usage analytics
router.get("/usage", verifyJWT, adminOnly, getUsageAnalytics);

// Get user engagement metrics
router.get("/engagement", verifyJWT, adminOnly, getUserEngagementMetrics);

// Get churn analysis
router.get("/churn", verifyJWT, adminOnly, getChurnAnalysis);

export default router;
