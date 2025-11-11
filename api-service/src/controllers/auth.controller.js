import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import logger from "../utils/logger.js";

// Generate Access and Refresh Token
const generateAccessAndRefreshTokens = async (userId) => {
  try {
    // Check if required environment variables are set
    if (!process.env.ACCESS_TOKEN_SECRET) {
      throw new Error("ACCESS_TOKEN_SECRET environment variable is not set");
    }
    if (!process.env.REFRESH_TOKEN_SECRET) {
      throw new Error("REFRESH_TOKEN_SECRET environment variable is not set");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const accessToken = jwt.sign(
      { _id: userId },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m" }
    );
    const refreshToken = jwt.sign(
      { _id: userId },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d" }
    );

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    logger.error("Token generation error:", error);
    throw new ApiError(500, `Token generation failed: ${error.message}`);
  }
};

// Register User
export const registerUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  // Validation
  if (!firstName || !lastName || !email || !password) {
    throw new ApiError(400, "All fields are required");
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "User with this email already exists");
  }

  // Create user
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
  });

  // Remove password from response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while creating user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered successfully"));
});

// Login User
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  // Find user
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Check password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Check if user is active
  if (!user.isActive) {
    throw new ApiError(403, "Account is deactivated");
  }

  // Generate tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  // Remove password from user object
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // Set cookies
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

// Logout User
export const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

// Refresh Access Token
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken._id).select("+refreshToken");

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

// Get Current User
export const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Get user's subscription to include in response
  const Subscription = (await import("../models/subscription.model.js"))
    .default;
  const subscription = await Subscription.findOne({ userId })
    .populate("planId", "name displayName type features price")
    .sort({ createdAt: -1 });

  // Prepare user object with subscription data
  const userData = req.user.toObject();

  // Add subscription data to user object for frontend convenience
  if (subscription) {
    userData.subscription = {
      type: subscription.plan, // "free", "basic", "pro", "enterprise"
      id: subscription._id,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currentPeriodEnd: subscription.currentPeriodEnd,
      isActive: subscription.isActive(),
      planDetails: subscription.planId,
    };
  } else {
    // Default to free if no subscription found
    userData.subscription = {
      type: "free",
      status: "active",
      isActive: true,
    };
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, { user: userData }, "User fetched successfully")
    );
});

// Update User Profile
export const updateUserProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, email } = req.body;

  // Validation
  if (!firstName || !lastName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  // Check if email is already taken by another user
  const existingUser = await User.findOne({
    email,
    _id: { $ne: req.user._id },
  });

  if (existingUser) {
    throw new ApiError(409, "Email is already taken");
  }

  // Update user
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        firstName,
        lastName,
        email,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Profile updated successfully"));
});

// Change Password
export const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  // Validation
  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Old password and new password are required");
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, "New password must be at least 6 characters");
  }

  // Get user with password
  const user = await User.findById(req.user._id).select("+password");

  // Check old password
  const isOldPasswordValid = await user.comparePassword(oldPassword);
  if (!isOldPasswordValid) {
    throw new ApiError(400, "Old password is incorrect");
  }

  // Update password
  user.password = newPassword;
  await user.save();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

// Delete User Account
export const deleteUserAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  // Validation
  if (!password) {
    throw new ApiError(400, "Password is required to delete account");
  }

  // Get user with password
  const user = await User.findById(req.user._id).select("+password");

  // Check password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(400, "Password is incorrect");
  }

  // Delete user
  await User.findByIdAndDelete(req.user._id);

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "Account deleted successfully"));
});

// Get All Users (Admin Only)
export const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, role } = req.query;

  // Build query
  const query = {};
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }
  if (role) {
    query.role = role;
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const users = await User.find(query)
    .select("-password -refreshToken")
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  const totalUsers = await User.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalUsers,
          pages: Math.ceil(totalUsers / parseInt(limit)),
        },
      },
      "Users fetched successfully"
    )
  );
});

// Get User by ID (Admin Only)
export const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select("-password -refreshToken");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User fetched successfully"));
});

// Update User Status (Admin Only)
export const updateUserStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { isActive, role } = req.body;

  const updateData = {};
  if (isActive !== undefined) updateData.isActive = isActive;
  if (role) updateData.role = role;

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updateData },
    { new: true }
  ).select("-password -refreshToken");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User status updated successfully"));
});

// Delete User (Admin Only)
export const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Prevent admin from deleting themselves
  if (userId === req.user._id.toString()) {
    throw new ApiError(400, "You cannot delete your own account");
  }

  const user = await User.findByIdAndDelete(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "User deleted successfully"));
});
