import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    // Get access token first (priority)
    const accessToken =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");
    // console.log("accessToken", accessToken);

    // If no access token, check for refresh token but don't use it for verification
    if (!accessToken) {
      throw new ApiError(401, "Unauthorized request - No access token");
    }

    try {
      // Try to verify access token
      const decodedToken = jwt.verify(
        accessToken,
        process.env.ACCESS_TOKEN_SECRET
      );

      const user = await User.findById(decodedToken?._id).select(
        "-password -refreshToken"
      );

      if (!user) {
        throw new ApiError(401, "Invalid User Access Token");
      }

      req.user = user;
      next();
    } catch (jwtError) {
      // If token is expired, return specific error message
      if (jwtError.name === "TokenExpiredError") {
        throw new ApiError(
          401,
          "Access token expired. Please refresh your token."
        );
      }
      // For other JWT errors, throw them
      throw new ApiError(401, jwtError?.message || "Invalid access token");
    }
  } catch (error) {
    // If it's already an ApiError, throw it as is
    if (error instanceof ApiError) {
      throw error;
    }
    // Otherwise, wrap it
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});
