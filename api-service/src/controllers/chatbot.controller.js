import { asyncHandler, ApiError, ApiResponse, logger } from "../utils/index.js";
import {
  sanitizeQuery,
  sanitizeText,
  sanitizeSystemPrompt,
} from "../utils/sanitize.js";
import { sanitizeModelMetadata } from "../utils/modelSanitizer.js";
import {
  createChatbot,
  trainChatbot,
  trainChatbotWithText,
  queryChatbot,
  getChatbotById,
  getUserChatbots,
  updateChatbot,
  updateChatbotWidget,
  deleteChatbot,
  getConversationHistory,
  generateWidgetCode,
  getAllTemplates,
} from "../services/ai/services/chatbot/index.js";
import Chatbot from "../models/chatbot.model.js";
import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";
import Service from "../models/service.model.js";
import ServiceUsage from "../models/serviceUsage.model.js";
import { checkUsageLimits, getTodayUsage } from "../utils/index.js";
import { getChatbotLimits, isFreePlan } from "../utils/chatbotLimits.js";
import fs from "fs/promises";
import path from "path";
import { getBaseUrl } from "../utils/index.js";
import crypto from "crypto";

/**
 * Create a new chatbot
 */
export const createChatbotHandler = asyncHandler(async (req, res) => {
  const { name, description, config, template } = req.body;
  const userId = req.user._id;

  // Sanitize inputs
  const sanitizedName = sanitizeText(name);
  const sanitizedDescription = sanitizeText(description);
  const sanitizedConfig = config
    ? {
        ...config,
        systemPrompt: config.systemPrompt
          ? sanitizeSystemPrompt(config.systemPrompt)
          : undefined,
      }
    : {};

  // Check subscription limits
  const subscription = await Subscription.findOne({ userId }).populate(
    "planId"
  );
  const hasActiveSubscription = subscription && subscription.isActive();

  if (!hasActiveSubscription) {
    throw new ApiError(403, "Active subscription required to create chatbots");
  }

  // Get plan and limits
  const plan = subscription.planId || {};
  const limits = getChatbotLimits(plan);

  // Check current chatbot count
  // In development mode, allow up to 10 chatbots for testing (rate limiting is also disabled)
  const maxChatbots =
    process.env.NODE_ENV !== "production"
      ? Math.max(limits.chatbotsPerAccount, 10) // At least 10 in dev mode
      : limits.chatbotsPerAccount;

  const currentChatbots = await Chatbot.countDocuments({ userId });
  if (currentChatbots >= maxChatbots) {
    throw new ApiError(
      403,
      `Chatbot limit reached. Maximum ${maxChatbots} chatbot${
        maxChatbots > 1 ? "s" : ""
      } allowed on your plan.`
    );
  }

  // Create chatbot
  const chatbot = await createChatbot(userId, {
    name: sanitizedName,
    description: sanitizedDescription,
    config: sanitizedConfig,
    template,
  });

  // Get base URL for widget
  const baseUrl = getBaseUrl();
  const widgetCode = generateWidgetCode(
    chatbot._id,
    chatbot.widget.apiKey,
    baseUrl
  );

  // Update widget URL in chatbot
  chatbot.widget.widgetUrl = widgetCode.url;
  await chatbot.save();

  logger.info(`Chatbot created: ${chatbot._id} by user ${userId}`);

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        chatbot: {
          id: chatbot._id,
          name: chatbot.name,
          description: chatbot.description,
          status: chatbot.status,
          collectionId: chatbot.collectionId,
          widget: {
            apiKey: chatbot.widget.apiKey,
            enabled: chatbot.widget.enabled,
            url: chatbot.widget.widgetUrl,
            code: widgetCode,
          },
          config: chatbot.config,
          trainingData: {
            totalDocuments: chatbot.trainingData.totalDocuments || 0,
            totalChunks: chatbot.trainingData.totalChunks || 0,
            totalSize: chatbot.trainingData.totalSize || 0,
            trainingStatus: chatbot.trainingData.trainingStatus || "pending",
            lastTrainedAt: chatbot.trainingData.lastTrainedAt || null,
            fileTypes: chatbot.trainingData.fileTypes || [],
            isEmpty: (chatbot.trainingData.totalDocuments || 0) === 0,
            message:
              (chatbot.trainingData.totalDocuments || 0) === 0
                ? "No training data yet. Please add training data to train your chatbot."
                : "Training data available",
          },
          createdAt: chatbot.createdAt,
        },
      },
      "Chatbot created successfully. Please add training data to train your chatbot."
    )
  );
});

/**
 * Get all chatbots for a user
 */
export const getChatbots = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const chatbots = await getUserChatbots(userId);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        chatbots: chatbots.map((chatbot) => ({
          id: chatbot._id,
          name: chatbot.name,
          description: chatbot.description,
          status: chatbot.status,
          trainingData: {
            totalDocuments: chatbot.trainingData.totalDocuments || 0,
            totalChunks: chatbot.trainingData.totalChunks || 0,
            totalSize: chatbot.trainingData.totalSize || 0,
            lastTrainedAt: chatbot.trainingData.lastTrainedAt || null,
            trainingStatus: chatbot.trainingData.trainingStatus || "pending",
            fileTypes: chatbot.trainingData.fileTypes || [],
            isEmpty: (chatbot.trainingData.totalDocuments || 0) === 0,
            message:
              (chatbot.trainingData.totalDocuments || 0) === 0
                ? "No training data yet. Please add training data to train your chatbot."
                : "Training data available",
          },
          statistics: chatbot.statistics,
          createdAt: chatbot.createdAt,
          updatedAt: chatbot.updatedAt,
        })),
        total: chatbots.length,
      },
      "Chatbots retrieved successfully"
    )
  );
});

/**
 * Get a single chatbot by ID
 */
export const getChatbot = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const chatbot = await getChatbotById(id, userId);
  if (!chatbot) {
    throw new ApiError(404, "Chatbot not found");
  }

  const baseUrl = getBaseUrl();
  const widgetCode = generateWidgetCode(
    chatbot._id,
    chatbot.widget.apiKey,
    baseUrl
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        chatbot: {
          id: chatbot._id,
          name: chatbot.name,
          description: chatbot.description,
          status: chatbot.status,
          collectionId: chatbot.collectionId,
          trainingData: {
            totalDocuments: chatbot.trainingData.totalDocuments || 0,
            totalChunks: chatbot.trainingData.totalChunks || 0,
            totalSize: chatbot.trainingData.totalSize || 0,
            lastTrainedAt: chatbot.trainingData.lastTrainedAt || null,
            trainingStatus: chatbot.trainingData.trainingStatus || "pending",
            fileTypes: chatbot.trainingData.fileTypes || [],
            isEmpty: (chatbot.trainingData.totalDocuments || 0) === 0,
            message:
              (chatbot.trainingData.totalDocuments || 0) === 0
                ? "No training data yet. Please add training data to train your chatbot."
                : "Training data available",
          },
          config: chatbot.config,
          widget: {
            apiKey: chatbot.widget.apiKey,
            enabled: chatbot.widget.enabled,
            url: chatbot.widget.widgetUrl,
            code: widgetCode,
          },
          statistics: chatbot.statistics,
          metadata: sanitizeModelMetadata(chatbot.metadata),
          createdAt: chatbot.createdAt,
          updatedAt: chatbot.updatedAt,
        },
      },
      "Chatbot retrieved successfully"
    )
  );
});

/**
 * Train chatbot with uploaded file (PDF/TXT)
 */
export const trainChatbotFile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  // Long-running operation: extend/clear default request timeout (connect-timeout)
  if (typeof req.clearTimeout === "function") {
    req.clearTimeout();
  }
  if (typeof req.setTimeout === "function") {
    // Allow up to 5 minutes for large file processing
    req.setTimeout(5 * 60 * 1000);
  }

  if (!req.file) {
    throw new ApiError(400, "No file uploaded");
  }

  // Verify chatbot ownership
  const chatbot = await getChatbotById(id, userId);
  if (!chatbot) {
    throw new ApiError(404, "Chatbot not found");
  }

  // Check subscription limits
  const subscription = await Subscription.findOne({ userId }).populate(
    "planId"
  );
  if (!subscription || !subscription.isActive()) {
    throw new ApiError(403, "Active subscription required to train chatbots");
  }

  // Get plan and limits
  const plan = subscription.planId || {};
  const limits = getChatbotLimits(plan);

  // Check PDF count and size limits for free plan
  if (isFreePlan(plan.type)) {
    // Check PDF count limit (3 PDFs for free plan)
    if (chatbot.trainingData.totalDocuments >= limits.maxPdfFiles) {
      // Clean up uploaded file
      try {
        await fs.unlink(req.file.path);
      } catch (error) {
        logger.warn(`Failed to delete file: ${error.message}`);
      }
      throw new ApiError(
        403,
        `Free plan limit: Maximum ${limits.maxPdfFiles} PDF files allowed per chatbot.`
      );
    }

    // Check total file size (10MB total for free plan)
    const fileSize = req.file.size;
    const currentTotalSize = chatbot.trainingData.totalSize || 0;
    if (currentTotalSize + fileSize > limits.maxTotalPdfSize) {
      // Clean up uploaded file
      try {
        await fs.unlink(req.file.path);
      } catch (error) {
        logger.warn(`Failed to delete file: ${error.message}`);
      }
      throw new ApiError(
        403,
        `Free plan limit: Maximum ${
          limits.maxTotalPdfSize / (1024 * 1024)
        }MB total size allowed per chatbot.`
      );
    }
  }

  const filePath = req.file.path;
  const mimetype = req.file.mimetype;

  try {
    // Train chatbot
    const result = await trainChatbot(id, filePath, mimetype);

    // Get AI Chatbot service for usage tracking
    const service = await Service.findOne({
      type: "ai_chatbot_builder",
      status: "active",
    });

    if (service) {
      // Track training usage
      await ServiceUsage.create({
        userId,
        serviceId: service._id,
        request: {
          type: "chatbot_training",
          prompt: `Training chatbot ${id} with file: ${req.file.originalname}`,
          parameters: {
            chatbotId: id,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimetype,
            chunks: result.chunks,
          },
        },
        response: {
          success: true,
          data: result,
        },
      });
    }

    // Clean up uploaded file
    try {
      await fs.unlink(filePath);
    } catch (error) {
      logger.warn(`Failed to delete training file: ${error.message}`);
    }

    logger.info(`Chatbot trained: ${id} with ${result.chunks} chunks`);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          message: "Chatbot trained successfully",
          chunks: result.chunks,
          pages: result.pages || 1,
          status: result.status,
        },
        "Chatbot trained successfully"
      )
    );
  } catch (error) {
    // Clean up uploaded file on error
    try {
      await fs.unlink(filePath);
    } catch (unlinkError) {
      logger.warn(`Failed to delete training file: ${unlinkError.message}`);
    }

    throw error;
  }
});

/**
 * Train chatbot with raw text
 */
export const trainChatbotText = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const userId = req.user._id;
  const startTime = Date.now();

  // Long-running operation: extend/clear default request timeout (connect-timeout)
  if (typeof req.clearTimeout === "function") {
    req.clearTimeout();
  }
  if (typeof req.setTimeout === "function") {
    // Allow up to 5 minutes for large text payloads
    req.setTimeout(5 * 60 * 1000);
  }

  // Sanitize text input (but keep content for training)
  // Note: We don't fully sanitize training text as it may contain legitimate content
  // Only remove dangerous HTML/scripts
  const sanitizedText = text
    ? text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    : "";

  // Verify chatbot ownership
  const chatbot = await getChatbotById(id, userId);
  if (!chatbot) {
    throw new ApiError(404, "Chatbot not found");
  }

  // Check if chatbot is in a valid state for training
  if (chatbot.status === "training") {
    throw new ApiError(
      409,
      "Chatbot is currently being trained. Please wait for the current training to complete."
    );
  }

  // Check subscription limits
  const subscription = await Subscription.findOne({ userId });
  if (!subscription || !subscription.isActive()) {
    throw new ApiError(403, "Active subscription required to train chatbots");
  }

  // Train chatbot
  const result = await trainChatbotWithText(id, sanitizedText);

  // Track usage
  const service = await Service.findOne({
    type: "ai_chatbot_builder",
    status: "active",
  });

  if (service) {
    await ServiceUsage.create({
      userId,
      serviceId: service._id,
      request: {
        type: "chatbot_training",
        prompt: `Training chatbot ${id} with text content`,
        parameters: {
          chatbotId: id,
          textLength: sanitizedText.length,
          chunks: result.chunks,
          trainingType: "text",
        },
      },
      response: {
        success: true,
        data: result,
        responseTime: Date.now() - startTime,
      },
    });
  }

  logger.info(
    `✅ Chatbot ${id} trained with text: ${result.chunks} chunks, ${result.textLength} characters in ${result.processingTime}ms`
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        message: "Chatbot trained successfully",
        chunks: result.chunks,
        status: result.status,
        textLength: result.textLength,
        avgChunkSize: result.avgChunkSize,
        processingTime: result.processingTime,
        chatbotId: id,
      },
      "Chatbot trained successfully"
    )
  );
});

/**
 * Query chatbot
 */
export const queryChatbotHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { query, sessionId } = req.body;
  const userId = req.user._id;
  const startTime = Date.now();

  // Sanitize query input
  const sanitizedQuery = sanitizeQuery(query);

  // Verify chatbot ownership
  const chatbot = await getChatbotById(id, userId);
  if (!chatbot) {
    throw new ApiError(404, "Chatbot not found");
  }

  // Check subscription limits
  const subscription = await Subscription.findOne({ userId });
  if (!subscription || !subscription.isActive()) {
    throw new ApiError(403, "Active subscription required to use chatbots");
  }

  // Generate session ID if not provided
  const finalSessionId =
    sessionId ||
    `session-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;

  try {
    // Query chatbot
    const result = await queryChatbot(
      id,
      sanitizedQuery,
      finalSessionId,
      userId
    );
    const duration = Date.now() - startTime;

    // Track usage
    const service = await Service.findOne({
      type: "ai_chatbot_builder",
      status: "active",
    });

    if (service) {
      await ServiceUsage.create({
        userId,
        serviceId: service._id,
        request: {
          type: "chatbot_query",
          prompt: sanitizedQuery,
          parameters: {
            chatbotId: id,
            sessionId: finalSessionId,
          },
        },
        response: {
          success: true,
          data: {
            response: result.response,
            tokens: result.tokens,
          },
          responseTime: duration,
        },
        cost: {
          tokens: result.tokens,
        },
      });
    }

    logger.info(`Chatbot query completed: ${id} in ${duration}ms`);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          response: result.response,
          sessionId: finalSessionId,
          tokens: result.tokens,
          responseTime: duration,
          sources: result.sources,
        },
        "Query processed successfully"
      )
    );
  } catch (error) {
    const duration = Date.now() - startTime;

    // Track failed usage
    const service = await Service.findOne({
      type: "ai_chatbot_builder",
      status: "active",
    });

    if (service) {
      await ServiceUsage.create({
        userId,
        serviceId: service._id,
        request: {
          type: "chatbot_query",
          prompt: sanitizedQuery,
          parameters: {
            chatbotId: id,
            sessionId: finalSessionId,
          },
        },
        response: {
          success: false,
          error: {
            code: error.code || "QUERY_FAILED",
            message: error.message,
          },
          responseTime: duration,
        },
      });
    }

    throw error;
  }
});

/**
 * Get conversation history
 */
export const getConversationHistoryHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sessionId } = req.query;
  const userId = req.user._id;

  // Verify chatbot ownership
  const chatbot = await getChatbotById(id, userId);
  if (!chatbot) {
    throw new ApiError(404, "Chatbot not found");
  }

  const history = await getConversationHistory(id, sessionId || null);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        conversations: history.map((conv) => ({
          id: conv._id,
          sessionId: conv.sessionId,
          messages: conv.messages,
          messageCount: conv.messageCount,
          totalTokens: conv.totalTokens,
          status: conv.status,
          createdAt: conv.createdAt,
        })),
        total: history.length,
      },
      "Conversation history retrieved successfully"
    )
  );
});

/**
 * Update chatbot configuration
 */
export const updateChatbotHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, config } = req.body;
  const userId = req.user._id;

  // Sanitize inputs
  const sanitizedData = {};
  if (name !== undefined) {
    sanitizedData.name = sanitizeText(name);
  }
  if (description !== undefined) {
    sanitizedData.description = sanitizeText(description);
  }
  if (config !== undefined) {
    sanitizedData.config = {
      ...config,
      systemPrompt: config.systemPrompt
        ? sanitizeSystemPrompt(config.systemPrompt)
        : undefined,
    };
  }

  try {
    const chatbot = await updateChatbot(id, userId, sanitizedData);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          chatbot: {
            id: chatbot._id,
            name: chatbot.name,
            description: chatbot.description,
            config: chatbot.config,
            status: chatbot.status,
            updatedAt: chatbot.updatedAt,
          },
        },
        "Chatbot updated successfully"
      )
    );
  } catch (error) {
    logger.error(`Error updating chatbot ${id}:`, error);
    if (
      error.message.includes("not found") ||
      error.message.includes("denied")
    ) {
      throw new ApiError(404, error.message);
    }
    throw new ApiError(500, `Failed to update chatbot: ${error.message}`);
  }
});

/**
 * Update widget settings
 */
export const updateChatbotWidgetHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { enabled, regenerateApiKey, theme } = req.body;
  const userId = req.user._id;

  const widgetData = {};
  if (enabled !== undefined) {
    widgetData.enabled = enabled;
  }
  if (regenerateApiKey !== undefined) {
    widgetData.regenerateApiKey = regenerateApiKey;
  }
  if (theme !== undefined) {
    widgetData.theme = theme;
  }

  try {
    const chatbot = await updateChatbotWidget(id, userId, widgetData);

    // Regenerate widget code if API key was regenerated
    let widgetCode = null;
    if (regenerateApiKey === true) {
      const baseUrl = getBaseUrl();
      widgetCode = generateWidgetCode(
        chatbot._id,
        chatbot.widget.apiKey,
        baseUrl
      );
      chatbot.widget.widgetUrl = widgetCode.url;
      await chatbot.save();
    } else {
      const baseUrl = getBaseUrl();
      widgetCode = generateWidgetCode(
        chatbot._id,
        chatbot.widget.apiKey,
        baseUrl
      );
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          widget: {
            apiKey: chatbot.widget.apiKey,
            enabled: chatbot.widget.enabled,
            theme: chatbot.widget.theme,
            url: widgetCode.url,
            code: widgetCode,
          },
        },
        "Widget settings updated successfully"
      )
    );
  } catch (error) {
    logger.error(`Error updating widget for chatbot ${id}:`, error);
    if (
      error.message.includes("not found") ||
      error.message.includes("denied")
    ) {
      throw new ApiError(404, error.message);
    }
    throw new ApiError(500, `Failed to update widget: ${error.message}`);
  }
});

/**
 * Delete chatbot
 */
export const deleteChatbotHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  await deleteChatbot(id, userId);

  logger.info(`Chatbot deleted: ${id} by user ${userId}`);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Chatbot deleted successfully"));
});

/**
 * Get widget code
 */
export const getWidgetCode = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const chatbot = await getChatbotById(id, userId);
  if (!chatbot) {
    throw new ApiError(404, "Chatbot not found");
  }

  const baseUrl = getBaseUrl();
  const widgetCode = generateWidgetCode(
    chatbot._id,
    chatbot.widget.apiKey,
    baseUrl
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        widget: {
          apiKey: chatbot.widget.apiKey,
          enabled: chatbot.widget.enabled,
          url: widgetCode.url,
          code: widgetCode,
        },
      },
      "Widget code retrieved successfully"
    )
  );
});

/**
 * Public widget query endpoint (for widget use)
 */
export const widgetQuery = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { query, apiKey } = req.body;
  const startTime = Date.now();

  // Sanitize query input
  const sanitizedQuery = sanitizeQuery(query);

  // Verify API key - check chatbot exists first
  const chatbot = await Chatbot.findById(id);

  if (!chatbot) {
    throw new ApiError(404, "Chatbot not found");
  }

  // Check if widget is enabled
  if (!chatbot.widget.enabled) {
    throw new ApiError(403, "Widget is disabled for this chatbot");
  }

  // Check if chatbot is active or training (training chatbots can still be queried)
  if (chatbot.status !== "active" && chatbot.status !== "training") {
    throw new ApiError(
      403,
      `Chatbot is not available. Current status: ${chatbot.status}`
    );
  }

  // Verify API key
  if (chatbot.widget.apiKey !== apiKey) {
    throw new ApiError(401, "Invalid API key");
  }

  try {
    // Generate anonymous session ID
    const sessionId = `widget-${Date.now()}-${crypto
      .randomBytes(8)
      .toString("hex")}`;

    // Query chatbot
    const result = await queryChatbot(
      id,
      sanitizedQuery,
      sessionId,
      chatbot.userId
    );
    const duration = Date.now() - startTime;

    // Track usage (without user context for widget)
    const service = await Service.findOne({
      type: "ai_chatbot_builder",
      status: "active",
    });

    if (service) {
      await ServiceUsage.create({
        userId: chatbot.userId,
        serviceId: service._id,
        request: {
          type: "chatbot_query_widget",
          prompt: sanitizedQuery,
          parameters: {
            chatbotId: id,
            sessionId,
            source: "widget",
          },
        },
        response: {
          success: true,
          data: {
            response: result.response,
            tokens: result.tokens,
          },
          responseTime: duration,
        },
        cost: {
          tokens: result.tokens,
        },
      });

      // Update chatbot statistics
      await chatbot.incrementQuery(true, duration);
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          response: result.response,
          sessionId,
          tokens: result.tokens,
          responseTime: duration,
        },
        "Query processed successfully"
      )
    );
  } catch (error) {
    const duration = Date.now() - startTime;

    // Update chatbot statistics
    await chatbot.incrementQuery(false, duration);

    throw error;
  }
});

/**
 * Get widget info (public endpoint for widget to fetch chatbot name and description)
 */
export const getWidgetInfo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { apiKey } = req.query;

  if (!apiKey) {
    throw new ApiError(400, "API key is required");
  }

  // Find chatbot by ID
  const chatbot = await Chatbot.findById(id);

  if (!chatbot) {
    throw new ApiError(404, "Chatbot not found");
  }

  // Verify API key
  if (chatbot.widget.apiKey !== apiKey) {
    throw new ApiError(401, "Invalid API key");
  }

  // Check if widget is enabled
  if (!chatbot.widget.enabled) {
    throw new ApiError(403, "Widget is disabled for this chatbot");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        name: chatbot.name,
        description: chatbot.description || "",
      },
      "Widget info retrieved successfully"
    )
  );
});

/**
 * Get all available chatbot templates
 */
export const getChatbotTemplates = asyncHandler(async (req, res) => {
  const templates = await getAllTemplates();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        templates,
        total: templates.length,
      },
      "Chatbot templates retrieved successfully"
    )
  );
});

/**
 * Get all ChromaDB collections (Admin/Debug endpoint)
 */
export const getChromaCollections = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  try {
    const { getAllChromaCollections } = await import(
      "../services/ai/services/chatbot/chatbotService.js"
    );
    const collections = await getAllChromaCollections();

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          collections: collections,
          total: collections.length,
        },
        "ChromaDB collections retrieved successfully"
      )
    );
  } catch (error) {
    logger.error("Error getting ChromaDB collections:", error);
    throw new ApiError(500, `Failed to get collections: ${error.message}`);
  }
});

/**
 * Get specific ChromaDB collection details
 */
export const getChromaCollection = asyncHandler(async (req, res) => {
  const { collectionName } = req.params;
  const userId = req.user._id;

  if (!collectionName) {
    throw new ApiError(400, "Collection name is required");
  }

  try {
    const { getChromaCollectionDetails } = await import(
      "../services/ai/services/chatbot/chatbotService.js"
    );
    const collectionDetails = await getChromaCollectionDetails(collectionName);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          collectionDetails,
          "ChromaDB collection details retrieved successfully"
        )
      );
  } catch (error) {
    logger.error(`Error getting ChromaDB collection ${collectionName}:`, error);
    throw new ApiError(500, `Failed to get collection: ${error.message}`);
  }
});

/**
 * Get chatbot's collection documents (User's own chatbot)
 */
export const getChatbotDocuments = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const { limit = 50, offset = 0, search } = req.query;

  try {
    const { getChatbotCollectionDocuments } = await import(
      "../services/ai/services/chatbot/chatbotService.js"
    );

    const result = await getChatbotCollectionDocuments(id, userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      search: search || null,
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          result,
          "Chatbot collection documents retrieved successfully"
        )
      );
  } catch (error) {
    logger.error(`Error getting chatbot ${id} documents:`, error);
    if (
      error.message.includes("not found") ||
      error.message.includes("denied")
    ) {
      throw new ApiError(404, error.message);
    }
    throw new ApiError(500, `Failed to get documents: ${error.message}`);
  }
});

/**
 * Update a document in chatbot collection
 */
export const updateChatbotDocument = asyncHandler(async (req, res) => {
  const { id, documentId } = req.params;
  const { text } = req.body;
  const userId = req.user._id;

  if (!text || text.trim().length === 0) {
    throw new ApiError(400, "Document text is required");
  }

  // Import constant for validation
  const { MAX_DOCUMENT_LENGTH } = await import(
    "../services/ai/services/chatbot/utils/constants.js"
  );

  if (text.length > MAX_DOCUMENT_LENGTH) {
    throw new ApiError(
      400,
      `Document text cannot exceed ${MAX_DOCUMENT_LENGTH.toLocaleString()} characters`
    );
  }

  try {
    const { updateChatbotCollectionDocument } = await import(
      "../services/ai/services/chatbot/chatbotService.js"
    );

    const result = await updateChatbotCollectionDocument(
      id,
      userId,
      documentId,
      text.trim()
    );

    return res
      .status(200)
      .json(new ApiResponse(200, result, "Document updated successfully"));
  } catch (error) {
    logger.error(
      `Error updating document ${documentId} in chatbot ${id}:`,
      error
    );
    if (
      error.message.includes("not found") ||
      error.message.includes("denied")
    ) {
      throw new ApiError(404, error.message);
    }
    throw new ApiError(500, `Failed to update document: ${error.message}`);
  }
});

/**
 * Delete documents from chatbot collection
 */
export const deleteChatbotDocuments = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { documentIds } = req.body;
  const userId = req.user._id;

  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    throw new ApiError(400, "Document IDs array is required");
  }

  // Import constant for validation
  const { MAX_DELETE_BATCH_SIZE } = await import(
    "../services/ai/services/chatbot/utils/constants.js"
  );

  if (documentIds.length > MAX_DELETE_BATCH_SIZE) {
    throw new ApiError(
      400,
      `Cannot delete more than ${MAX_DELETE_BATCH_SIZE} documents at once`
    );
  }

  try {
    const { deleteChatbotCollectionDocuments } = await import(
      "../services/ai/services/chatbot/chatbotService.js"
    );

    const result = await deleteChatbotCollectionDocuments(
      id,
      userId,
      documentIds
    );

    return res
      .status(200)
      .json(new ApiResponse(200, result, "Documents deleted successfully"));
  } catch (error) {
    logger.error(`Error deleting documents from chatbot ${id}:`, error);
    if (
      error.message.includes("not found") ||
      error.message.includes("denied")
    ) {
      throw new ApiError(404, error.message);
    }
    throw new ApiError(500, `Failed to delete documents: ${error.message}`);
  }
});
