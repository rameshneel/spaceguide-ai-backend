import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import timeout from "connect-timeout";

// Import routes
import apiRoutes from "./routes/index.js";

// Import middleware
import errorHandler from "./middleware/errorHandler.middleware.js";
import { socketIOMiddleware } from "./middleware/socketIO.middleware.js";
import logger from "./utils/logger.js";

const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://cdn.socket.io", // Allow Socket.IO CDN
        ],
        scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers (onclick, etc.)
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          process.env.BASE_URL ||
            process.env.API_URL ||
            `http://localhost:${process.env.PORT || 5000}`,
          process.env.FRONTEND_URL || "http://localhost:3000",
          "https://cdn.socket.io",
          "wss://cdn.socket.io",
        ],
      },
    },
    // Allow cross-origin resource sharing for images and static files
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(compression());

// Cookie parser middleware (MUST be before CORS)
app.use(cookieParser());

// CORS configuration
const getCorsOrigins = () => {
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim());
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

  return [
    frontendUrl,
    baseUrl,
    "http://127.0.0.1:5000",
    "file://", // For local HTML files
    "null", // For local HTML files
  ];
};

const corsOrigins = getCorsOrigins();

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    optionsSuccessStatus: 200,
  })
);

// Rate limiting - Only enabled in production
if (process.env.NODE_ENV === "production") {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
  });
  app.use(limiter);
  logger.info("✅ Rate limiting enabled (Production mode)");
} else {
  logger.warn("⚠️ Rate limiting disabled (Development mode)");
}

// Logging
// if (process.env.NODE_ENV === "development") {
//   app.use(morgan("dev"));
// } else {
//   app.use(morgan("combined"));
// }

// Stripe webhook ke liye raw body middleware (BEFORE express.json())
// Stripe signature verification ke liye raw body buffer chahiye
app.use(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    // Store raw body for webhook signature verification
    req.rawBody = req.body;
    next();
  }
);

// Request timeout middleware (30 seconds)
// app.use(timeout("30s"));

// Timeout handler
app.use((req, res, next) => {
  if (!req.timedout) next();
  else {
    logger.warn(`Request timeout: ${req.method} ${req.path}`);
    res.status(408).json({
      success: false,
      message: "Request timeout. Please try again.",
    });
  }
});

// Body parsing middleware (baaki routes ke liye)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files - Set CORS and CORP headers for image access
const staticOptions = {
  setHeaders: (res, path) => {
    // Allow cross-origin access for images
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    // Cache images for better performance
    if (path.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  },
};

app.use("/uploads", express.static("uploads", staticOptions));
app.use(
  "/generated-images",
  express.static("public/generated-images", staticOptions)
);
app.use(express.static("public", staticOptions));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "AI Business Portal API is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
});

// API routes
app.use("/api", socketIOMiddleware, apiRoutes);

// 404 handler - Fixed for Express 5.x compatibility
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handling middleware
app.use(errorHandler);

export default app;
