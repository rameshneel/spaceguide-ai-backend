import express from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  getCurrentUser,
  updateUserProfile,
  changePassword,
  deleteUserAccount,
  getAllUsers,
  getUserById,
  updateUserStatus,
  deleteUser,
} from "../controllers/auth.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { adminOnly, preventSelfAction } from "../middleware/role.middleware.js";
import {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validatePasswordChange,
  validateAccountDeletion,
  validateUserStatusUpdate,
  validateUserQuery,
  validateRefreshToken,
} from "../validation/index.js";

const router = express.Router();

// ========================================
// AUTHENTICATION ROUTES (Public)
// ========================================

// User Registration
router.post("/register", validateRegister, registerUser);

// User Login
router.post("/login", validateLogin, loginUser);

// Refresh Access Token
router.post("/tokens/refresh", validateRefreshToken, refreshAccessToken);
// Alias for convenience
router.post("/refresh", validateRefreshToken, refreshAccessToken);

// ========================================
// USER SESSION ROUTES (Protected)
// ========================================

// User Logout
router.post("/logout", verifyJWT, logoutUser);

// ========================================
// CURRENT USER ROUTES (Protected)
// ========================================

// Get Current User Profile
router.get("/profile", verifyJWT, getCurrentUser);

// Update Current User Profile
router.put("/profile", verifyJWT, validateProfileUpdate, updateUserProfile);

// Change Current User Password
router.put(
  "/profile/password",
  verifyJWT,
  validatePasswordChange,
  changePassword
);

// Delete Current User Account
router.delete(
  "/profile",
  verifyJWT,
  validateAccountDeletion,
  deleteUserAccount
);

// ========================================
// USER MANAGEMENT ROUTES (Admin Only)
// ========================================

// Get All Users (with pagination, search, filter)
router.get("/users", verifyJWT, adminOnly, validateUserQuery, getAllUsers);

// Get User by ID
router.get("/users/:userId", verifyJWT, adminOnly, getUserById);

// Update User Status/Role
router.patch(
  "/users/:userId",
  verifyJWT,
  adminOnly,
  preventSelfAction,
  validateUserStatusUpdate,
  updateUserStatus
);

// Delete User Account
router.delete(
  "/users/:userId",
  verifyJWT,
  adminOnly,
  preventSelfAction,
  deleteUser
);

export default router;
