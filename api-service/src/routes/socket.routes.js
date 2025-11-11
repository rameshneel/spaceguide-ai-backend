import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { getSocketIOService } from "../services/communication/socketIOService.js";

const router = express.Router();

// ========================================
// SOCKET.IO REAL-TIME FEATURES ROUTES
// ========================================

// Get connected users count
router.get(
  "/connected-users",
  verifyJWT,
  asyncHandler(async (req, res) => {
    const socketService = getSocketIOService();

    if (!socketService) {
      throw new ApiError(503, "Socket.IO service not available");
    }

    const connectedUsers = socketService.getConnectedUsers();
    const connectedCount = socketService.getConnectedUsersCount();

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          connectedCount: connectedCount,
          connectedUsers: connectedUsers.map((user) => ({
            userId: user.userId,
            firstName: user.user.firstName,
            lastName: user.user.lastName,
            email: user.user.email,
            role: user.user.role,
            connectedAt: user.connectedAt,
          })),
        },
        "Connected users retrieved successfully"
      )
    );
  })
);

// Check if specific user is online
router.get(
  "/user/:userId/status",
  verifyJWT,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const socketService = getSocketIOService();

    if (!socketService) {
      throw new ApiError(503, "Socket.IO service not available");
    }

    const isOnline = socketService.isUserConnected(userId);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          userId: userId,
          isOnline: isOnline,
          timestamp: new Date(),
        },
        "User status retrieved successfully"
      )
    );
  })
);

// Send notification to specific user
router.post(
  "/notify/:userId",
  verifyJWT,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { title, message, type = "info", data = {} } = req.body;

    const socketService = getSocketIOService();

    if (!socketService) {
      throw new ApiError(503, "Socket.IO service not available");
    }

    const notification = {
      id: Date.now().toString(),
      title: title,
      message: message,
      type: type,
      data: data,
      sender: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      },
    };

    const sent = socketService.emitToUser(userId, "notification", notification);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          notification: notification,
          sent: sent,
          timestamp: new Date(),
        },
        sent ? "Notification sent successfully" : "User is offline"
      )
    );
  })
);

// Admin broadcast to all users
router.post(
  "/admin/broadcast",
  verifyJWT,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
      throw new ApiError(403, "Admin access required");
    }

    const { message, type = "info", data = {} } = req.body;
    const socketService = getSocketIOService();

    if (!socketService) {
      throw new ApiError(503, "Socket.IO service not available");
    }

    const broadcast = {
      id: Date.now().toString(),
      message: message,
      type: type,
      data: data,
      admin: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      },
    };

    socketService.emitToAll("admin_message", broadcast);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          broadcast: broadcast,
          timestamp: new Date(),
        },
        "Admin broadcast sent successfully"
      )
    );
  })
);

// Admin broadcast to specific role
router.post(
  "/admin/broadcast/:role",
  verifyJWT,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
      throw new ApiError(403, "Admin access required");
    }

    const { role } = req.params;
    const { message, type = "info", data = {} } = req.body;
    const socketService = getSocketIOService();

    if (!socketService) {
      throw new ApiError(503, "Socket.IO service not available");
    }

    const validRoles = ["admin", "customer", "business"];
    if (!validRoles.includes(role)) {
      throw new ApiError(400, "Invalid role specified");
    }

    const broadcast = {
      id: Date.now().toString(),
      message: message,
      type: type,
      data: data,
      targetRole: role,
      admin: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      },
    };

    socketService.emitToRole(role, "admin_message", broadcast);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          broadcast: broadcast,
          timestamp: new Date(),
        },
        `Admin broadcast sent to ${role} users successfully`
      )
    );
  })
);

// Get Socket.IO service status
router.get(
  "/status",
  verifyJWT,
  asyncHandler(async (req, res) => {
    const socketService = getSocketIOService();

    if (!socketService) {
      throw new ApiError(503, "Socket.IO service not available");
    }

    const connectedCount = socketService.getConnectedUsersCount();
    const connectedUsers = socketService.getConnectedUsers();

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          service: "Socket.IO",
          status: "active",
          connectedUsers: connectedCount,
          features: [
            "Real-time AI service updates",
            "Live notifications",
            "Admin broadcasts",
            "User presence tracking",
            "Chat functionality",
            "Role-based messaging",
          ],
          endpoints: {
            websocket: `ws://localhost:${process.env.PORT || 5000}`,
            events: [
              "ai_text_generation_start",
              "ai_text_generation_progress",
              "ai_service_complete",
              "notification",
              "admin_message",
              "user_online",
              "user_offline",
              "connected",
            ],
          },
          timestamp: new Date(),
        },
        "Socket.IO service status retrieved successfully"
      )
    );
  })
);

export default router;
