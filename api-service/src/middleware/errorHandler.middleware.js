import { ApiError } from "../utils/ApiError.js";
import { safeLogger as logger } from "../utils/logger.js";

const errorHandler = (err, req, res, next) => {
  if (err instanceof ApiError) {
    logger.error(`API Error: ${err.message}`, {
      statusCode: err.statusCode,
      errors: err.errors,
      path: req.path,
      method: req.method,
    });

    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
      // Only expose stack trace in development
      ...(false && { stack: err.stack }),
    });
  }

  logger.error("Internal Server Error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  return res.status(500).json({
    success: false,
    message: err.message || "Internal server error",
    errors: err.errors || [],
    // Only expose stack trace in development
    ...(false && { stack: err.stack }),
  });
};

export default errorHandler;
