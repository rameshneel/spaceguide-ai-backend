import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../../models/user.model.js";
import logger from "../../utils/logger.js";

// Socket.IO Service Class
export class SocketIOService {
  constructor(server) {
    // Get CORS origins from environment or use defaults
    const getSocketCorsOrigins = () => {
      if (process.env.CORS_ORIGINS) {
        return process.env.CORS_ORIGINS.split(",").map((origin) =>
          origin.trim()
        );
      }

      if (process.env.NODE_ENV === "production") {
        return [process.env.FRONTEND_URL || "https://yourdomain.com"];
      }

      // Development defaults
      const baseUrl =
        process.env.BASE_URL ||
        process.env.API_URL ||
        `http://localhost:${process.env.PORT || 5000}`;
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const embeddingUrl =
        process.env.EMBEDDING_API_URL || "http://localhost:8001";

      return [
        frontendUrl,
        baseUrl,
        embeddingUrl,
        "http://127.0.0.1:5000",
        "http://127.0.0.1:8001",
        "file://", // For local HTML files
        "null", // For local HTML files
      ];
    };

    this.io = new Server(server, {
      cors: {
        origin: getSocketCorsOrigins(),
        methods: ["GET", "POST", "OPTIONS"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
      },
      transports: ["websocket", "polling"],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.connectedUsers = new Map(); // userId -> socketId mapping
    this.userSockets = new Map(); // socketId -> userInfo mapping

    this.initializeMiddleware();
    this.initializeEventHandlers();
  }

  // Initialize Socket.IO middleware for authentication
  initializeMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace("Bearer ", "") ||
          socket.handshake.headers.token;

        if (!token) {
          return next(new Error("Authentication token required"));
        }

        try {
          const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
          const user = await User.findById(decoded._id).select(
            "-password -refreshToken"
          );

          if (!user) {
            return next(new Error("User not found"));
          }

          socket.userId = user._id;
          socket.user = user;
          next();
        } catch (jwtError) {
          // Provide more specific error messages
          if (jwtError.name === "TokenExpiredError") {
            return next(
              new Error(
                "Access token expired. Please refresh your token and reconnect."
              )
            );
          } else if (jwtError.name === "JsonWebTokenError") {
            return next(new Error("Invalid authentication token"));
          } else {
            return next(new Error("Authentication failed"));
          }
        }
      } catch (error) {
        next(new Error("Invalid authentication token"));
      }
    });
  }

  // Initialize event handlers
  initializeEventHandlers() {
    this.io.on("connection", (socket) => {
      logger.info(`🔌 User connected: ${socket.user.email} (${socket.id})`);

      // Store user connection
      this.connectedUsers.set(socket.userId, socket.id);
      this.userSockets.set(socket.id, {
        userId: socket.userId,
        user: socket.user,
        connectedAt: new Date(),
      });

      // Join user to their personal room
      socket.join(`user:${socket.userId}`);

      // Join user to role-based rooms
      socket.join(`role:${socket.user.role}`);

      // Emit connection success
      socket.emit("connected", {
        message: "Successfully connected to server",
        userId: socket.userId,
        user: socket.user,
        timestamp: new Date(),
      });

      // Notify other users about new connection (if needed)
      socket.broadcast.emit("user_online", {
        userId: socket.userId,
        user: {
          _id: socket.user._id,
          firstName: socket.user.firstName,
          lastName: socket.user.lastName,
          email: socket.user.email,
          role: socket.user.role,
        },
        timestamp: new Date(),
      });

      // Handle AI service events
      this.handleAIServiceEvents(socket);

      // Handle chat events
      this.handleChatEvents(socket);

      // Handle notification events
      this.handleNotificationEvents(socket);

      // Handle subscription events
      this.handleSubscriptionEvents(socket);

      // Handle admin events
      this.handleAdminEvents(socket);

      // Handle disconnection
      socket.on("disconnect", (reason) => {
        logger.info(
          `🔌 User disconnected: ${socket.user.email} (${socket.id}) - ${reason}`
        );

        // Remove user from connected users
        this.connectedUsers.delete(socket.userId);
        this.userSockets.delete(socket.id);

        // Notify other users about disconnection
        socket.broadcast.emit("user_offline", {
          userId: socket.userId,
          timestamp: new Date(),
        });
      });

      // Handle token refresh (for when access token is refreshed via API)
      this.handleTokenRefresh(socket);

      // Handle errors
      socket.on("error", (error) => {
        logger.error(`Socket error for user ${socket.userId}:`, error);
        socket.emit("error", {
          message: "An error occurred",
          error: error.message,
        });
      });
    });
  }

  // Handle token refresh for existing connections
  // This allows updating the Socket.IO connection with a new access token
  // after refreshing via /api/auth/tokens/refresh endpoint
  // Frontend should emit: socket.emit("refresh_token", { accessToken: newToken })
  // Backend will emit: "token_refreshed" on success or "token_refresh_error" on failure
  handleTokenRefresh(socket) {
    socket.on("refresh_token", async (data) => {
      try {
        const { accessToken } = data;

        if (!accessToken) {
          socket.emit("token_refresh_error", {
            message: "Access token is required",
            timestamp: new Date(),
          });
          return;
        }

        // Verify the new token
        try {
          const decoded = jwt.verify(
            accessToken,
            process.env.ACCESS_TOKEN_SECRET
          );
          const user = await User.findById(decoded._id).select(
            "-password -refreshToken"
          );

          if (!user) {
            socket.emit("token_refresh_error", {
              message: "User not found",
              timestamp: new Date(),
            });
            return;
          }

          // Update socket authentication
          const oldUserId = socket.userId;
          socket.userId = user._id;
          socket.user = user;

          // Update connected users map if userId changed
          if (oldUserId && oldUserId.toString() !== user._id.toString()) {
            this.connectedUsers.delete(oldUserId);
          }
          this.connectedUsers.set(user._id, socket.id);

          // Update user sockets map
          this.userSockets.set(socket.id, {
            userId: user._id,
            user: user,
            connectedAt: new Date(),
          });

          // Leave old rooms and join new ones
          if (oldUserId) {
            socket.leave(`user:${oldUserId}`);
          }
          // Leave old role room if socket.user exists
          if (socket.user?.role) {
            socket.leave(`role:${socket.user.role}`);
          }
          socket.join(`user:${user._id}`);
          socket.join(`role:${user.role}`);

          logger.info(
            `🔄 Token refreshed for socket ${socket.id} (User: ${user.email})`
          );

          // Emit success event
          socket.emit("token_refreshed", {
            message: "Token refreshed successfully",
            userId: user._id,
            timestamp: new Date(),
          });
        } catch (jwtError) {
          logger.warn(
            `Token refresh failed for socket ${socket.id}: ${jwtError.message}`
          );
          socket.emit("token_refresh_error", {
            message:
              jwtError.name === "TokenExpiredError"
                ? "Token expired. Please refresh again."
                : "Invalid access token",
            error: jwtError.message,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        logger.error(`Error handling token refresh: ${error.message}`);
        socket.emit("token_refresh_error", {
          message: "Failed to refresh token",
          error: error.message,
          timestamp: new Date(),
        });
      }
    });
  }

  // Handle AI service events
  handleAIServiceEvents(socket) {
    // AI Text Generation Request via Socket.IO
    socket.on("generate_text", async (data) => {
      logger.info(`📝 AI Text generation requested by user ${socket.userId}`);

      const { prompt, contentType, tone, length, language } = data;

      if (!prompt || !contentType) {
        socket.emit("text_generation_error", {
          error: "Prompt and content type are required",
          timestamp: new Date(),
        });
        return;
      }

      // Emit generation started event
      socket.emit("text_generation_started", {
        contentType: contentType,
        prompt: prompt,
        timestamp: new Date(),
      });

      // Import and call the service
      try {
        const { aiTextWriterService } = await import(
          "../../services/ai/services/textWriter/index.js"
        );

        // Start streaming
        const stream = aiTextWriterService.generateTextStream(
          prompt,
          contentType,
          {
            tone,
            length,
            language,
          }
        );

        let fullText = "";
        let finalResult = null;

        // Stream chunks in real-time
        for await (const chunk of stream) {
          if (chunk && typeof chunk === "object" && chunk.content) {
            finalResult = chunk;
            fullText = chunk.content;
          } else if (typeof chunk === "string") {
            fullText += chunk;
            // Emit each chunk as it arrives
            socket.emit("text_generation_chunk", {
              chunk: chunk,
              partial: fullText,
              timestamp: new Date(),
            });
          }
        }

        // Emit completion event
        socket.emit("text_generation_complete", {
          fullText: fullText,
          wordsGenerated: fullText.split(" ").length,
          contentType: contentType,
          model: finalResult?.model || "gpt-3.5-turbo",
          success: finalResult?.success || true,
          timestamp: new Date(),
        });

        logger.info(
          `✅ AI Text generation completed for user ${socket.userId}`
        );
      } catch (error) {
        logger.error("Text generation error:", error);
        socket.emit("text_generation_error", {
          error: error.message,
          timestamp: new Date(),
        });
      }
    });

    // AI Text Generation Progress
    socket.on("ai_text_generation_start", (data) => {
      logger.info(`📝 AI Text generation started for user ${socket.userId}`);
      socket.emit("ai_text_generation_progress", {
        status: "started",
        contentType: data.contentType,
        timestamp: new Date(),
      });
    });

    // AI Image Generation Progress
    socket.on("ai_image_generation_start", (data) => {
      logger.info(`🎨 AI Image generation started for user ${socket.userId}`);
      socket.emit("ai_image_generation_progress", {
        status: "started",
        prompt: data.prompt,
        timestamp: new Date(),
      });
    });

    // AI Service Completion
    socket.on("ai_service_complete", (data) => {
      logger.info(`✅ AI Service completed for user ${socket.userId}`);
      socket.emit("ai_service_result", {
        service: data.service,
        result: data.result,
        timestamp: new Date(),
      });
    });
  }

  // Handle subscription events
  handleSubscriptionEvents(socket) {
    // Subscription status request
    socket.on("subscription_status_request", () => {
      logger.info(`💳 Subscription status requested by ${socket.userId}`);
      socket.emit("subscription_status_requested", {
        userId: socket.userId,
        timestamp: new Date(),
      });
    });

    // Usage limit check
    socket.on("usage_limit_check", (data) => {
      logger.info(`📊 Usage limit check requested by ${socket.userId}:`, data);
      socket.emit("usage_limit_check_requested", {
        service: data.service,
        userId: socket.userId,
        timestamp: new Date(),
      });
    });

    // Upgrade prompt acknowledgment
    socket.on("upgrade_prompt_acknowledged", (data) => {
      logger.info(`✅ Upgrade prompt acknowledged by ${socket.userId}:`, data);
      socket.emit("upgrade_prompt_acknowledged", {
        promptId: data.promptId,
        action: data.action, // 'upgrade', 'dismiss', 'remind_later'
        userId: socket.userId,
        timestamp: new Date(),
      });
    });
  }

  // Handle chat events
  handleChatEvents(socket) {
    // Join chat room
    socket.on("join_chat", (chatId) => {
      socket.join(`chat:${chatId}`);
      logger.info(`💬 User ${socket.userId} joined chat ${chatId}`);

      socket.emit("chat_joined", {
        chatId: chatId,
        message: "Successfully joined chat",
        timestamp: new Date(),
      });
    });

    // Leave chat room
    socket.on("leave_chat", (chatId) => {
      socket.leave(`chat:${chatId}`);
      logger.info(`💬 User ${socket.userId} left chat ${chatId}`);
    });

    // Send message
    socket.on("send_message", (data) => {
      const { chatId, message, type = "text" } = data;

      logger.info(`💬 Message from user ${socket.userId} in chat ${chatId}`);

      // Broadcast message to all users in the chat
      socket.to(`chat:${chatId}`).emit("new_message", {
        chatId: chatId,
        message: {
          id: Date.now().toString(),
          senderId: socket.userId,
          sender: {
            _id: socket.user._id,
            firstName: socket.user.firstName,
            lastName: socket.user.lastName,
            email: socket.user.email,
          },
          content: message,
          type: type,
          timestamp: new Date(),
        },
      });
    });
  }

  // Handle notification events
  handleNotificationEvents(socket) {
    // Send notification to specific user
    socket.on("send_notification", (data) => {
      const { userId, notification } = data;

      if (this.connectedUsers.has(userId)) {
        const targetSocketId = this.connectedUsers.get(userId);
        this.io.to(targetSocketId).emit("notification", {
          ...notification,
          timestamp: new Date(),
        });
      }
    });

    // Mark notification as read
    socket.on("mark_notification_read", (notificationId) => {
      logger.info(
        `🔔 Notification ${notificationId} marked as read by user ${socket.userId}`
      );
      socket.emit("notification_read", {
        notificationId: notificationId,
        timestamp: new Date(),
      });
    });
  }

  // Handle admin events
  handleAdminEvents(socket) {
    // Admin broadcast to all users
    socket.on("admin_broadcast", (data) => {
      if (socket.user.role === "admin") {
        logger.info(`📢 Admin broadcast from ${socket.user.email}`);
        this.io.emit("admin_message", {
          message: data.message,
          type: data.type || "info",
          admin: {
            _id: socket.user._id,
            firstName: socket.user.firstName,
            lastName: socket.user.lastName,
          },
          timestamp: new Date(),
        });
      }
    });

    // Admin send to specific role
    socket.on("admin_role_message", (data) => {
      if (socket.user.role === "admin") {
        const { role, message, type = "info" } = data;
        logger.info(
          `📢 Admin message to role ${role} from ${socket.user.email}`
        );

        this.io.to(`role:${role}`).emit("admin_message", {
          message: message,
          type: type,
          targetRole: role,
          admin: {
            _id: socket.user._id,
            firstName: socket.user.firstName,
            lastName: socket.user.lastName,
          },
          timestamp: new Date(),
        });
      }
    });
  }

  // Public methods for external use
  emitToUser(userId, event, data) {
    if (this.connectedUsers.has(userId)) {
      const socketId = this.connectedUsers.get(userId);
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  emitToRole(role, event, data) {
    this.io.to(`role:${role}`).emit(event, data);
  }

  emitToAll(event, data) {
    this.io.emit(event, data);
  }

  getConnectedUsers() {
    return Array.from(this.userSockets.values());
  }

  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }
}

// Export singleton instance
let socketIOService = null;

export const initializeSocketIO = (server) => {
  if (!socketIOService) {
    socketIOService = new SocketIOService(server);
  }
  return socketIOService;
};

export const getSocketIOService = () => {
  return socketIOService;
};
