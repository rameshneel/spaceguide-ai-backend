import ServiceUsage from "../models/serviceUsage.model.js";
import { ERROR_CODES } from "../constants/index.js";
import logger from "./logger.js";

/**
 * Save failed service usage record
 * @param {Object} params - Parameters
 * @param {string} params.userId - User ID
 * @param {Object} params.serviceId - Service ID (MongoDB ObjectId)
 * @param {string} params.requestType - Request type (e.g., 'ai_text_writer', 'image_generation')
 * @param {Object} params.requestData - Request data (prompt, parameters, etc.)
 * @param {Error} params.error - Error object
 * @param {string} [params.errorCode] - Custom error code (optional)
 * @returns {Promise<boolean>} - Success status
 */
export const saveFailedUsage = async ({
  userId,
  serviceId,
  requestType,
  requestData,
  error,
  errorCode = null,
}) => {
  if (!userId || !serviceId) {
    logger.warn("Cannot save failed usage: missing userId or serviceId");
    return false;
  }

  try {
    const failedUsage = new ServiceUsage({
      userId: userId,
      serviceId: serviceId,
      request: {
        type: requestType,
        prompt: requestData.prompt || null,
        parameters: requestData.parameters || {},
        timestamp: new Date(),
      },
      response: {
        success: false,
        error: {
          code: errorCode || error.code || ERROR_CODES.UNKNOWN_ERROR,
          message: error.message || "Unknown error occurred",
        },
        timestamp: new Date(),
      },
    });

    await failedUsage.save();
    logger.info("Failed service usage saved", {
      userId: userId.toString(),
      serviceId: serviceId.toString(),
      requestType,
      errorCode: errorCode || error.code,
    });
    return true;
  } catch (saveError) {
    logger.error("Failed to save failed usage record", {
      error: saveError.message,
      userId: userId?.toString(),
      serviceId: serviceId?.toString(),
    });
    return false;
  }
};
