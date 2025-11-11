import { ApiError } from "../utils/ApiError.js";

// Admin middleware - Check if user has admin role
export const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required.",
    });
  }
  next();
};

// Customer middleware - Check if user has customer role
export const customerOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (req.user.role !== "customer") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Customer privileges required.",
    });
  }
  next();
};

// Check if user is active
export const checkUserActive = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (!req.user.isActive) {
    return res.status(403).json({
      success: false,
      message: "Account is deactivated. Please contact support.",
    });
  }
  next();
};

// Check if user is email verified
export const checkEmailVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: "Email verification required. Please verify your email address.",
    });
  }
  next();
};

// Prevent user from accessing their own admin routes
export const preventSelfAction = (req, res, next) => {
  const { userId } = req.params;

  if (userId === req.user._id.toString()) {
    return res.status(400).json({
      success: false,
      message: "You cannot perform this action on your own account",
    });
  }
  next();
};

// Rate limiting middleware for sensitive operations
export const sensitiveOperationRateLimit = (req, res, next) => {
  // This would integrate with express-rate-limit
  // For now, just pass through
  next();
};
