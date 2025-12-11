import { getSocketIOService } from "../services/communication/socketIOService.js";

// Socket.IO Middleware for Express routes
export const socketIOMiddleware = (req, res, next) => {
  const socketService = getSocketIOService();

  if (socketService) {
    req.socketIO = socketService;
  }

  next();
};

// Emit AI service events middleware
export const emitAIServiceEvent = (event, data) => {
  return (req, res, next) => {
    const socketService = getSocketIOService();

    if (socketService && req.user) {
      // Emit to specific user
      socketService.emitToUser(req.user._id, event, {
        ...data,
        userId: req.user._id,
        timestamp: new Date(),
      });
    }

    next();
  };
};

// Emit notification middleware
export const emitNotification = (notification) => {
  return (req, res, next) => {
    const socketService = getSocketIOService();

    if (socketService && req.user) {
      socketService.emitToUser(req.user._id, "notification", {
        ...notification,
        userId: req.user._id,
        timestamp: new Date(),
      });
    }

    next();
  };
};

// Emit admin broadcast middleware
export const emitAdminBroadcast = (message, type = "info") => {
  return (req, res, next) => {
    const socketService = getSocketIOService();

    if (socketService && req.user && req.user.role === "admin") {
      socketService.emitToAll("admin_message", {
        message: message,
        type: type,
        admin: {
          _id: req.user._id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
        },
        timestamp: new Date(),
      });
    }

    next();
  };
};
