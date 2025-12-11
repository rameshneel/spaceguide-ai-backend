import ServiceUsage from "../models/serviceUsage.model.js";
import Service from "../models/service.model.js";
import User from "../models/user.model.js";
import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";
import { aiTextWriterService } from "../services/ai/services/textWriter/index.js";
import { aiImageGeneratorService } from "../services/ai/services/imageGenerator/index.js";
import { aiVideoGeneratorService } from "../services/ai/services/videoGenerator/index.js";
import {
  asyncHandler,
  ApiError,
  ApiResponse,
  getImageUrl,
  checkUsageLimits,
  getTodayUsage,
  saveFailedUsage,
  logger,
} from "../utils/index.js";
import {
  DEFAULT_WORD_LIMIT,
  DEFAULT_IMAGE_LIMIT,
  DEFAULT_VIDEO_LIMIT,
  WORD_ESTIMATES,
  ERROR_CODES,
} from "../constants/index.js";

// Calculate image generation cost based on provider, size and quality
// Pricing: https://openai.com/pricing (DALL·E 3), Free providers have $0 cost
const calculateImageCost = (provider, size, quality) => {
  // Free providers
  if (
    provider === "pollinations" ||
    provider === "huggingface" ||
    provider === "hf"
  ) {
    return 0; // All free tier providers
  }

  // DALL·E 3 pricing (as of 2024):
  // Standard quality: $0.04/image (1024x1024), $0.08/image (1792x1024 or 1024x1792)
  // HD quality: $0.08/image (1024x1024), $0.12/image (1792x1024 or 1024x1792)
  const isLargeSize = size !== "1024x1024";
  const isHD = quality === "hd";

  if (isHD) {
    return isLargeSize ? 0.12 : 0.08; // HD pricing
  } else {
    return isLargeSize ? 0.08 : 0.04; // Standard pricing
  }
};

// AI Text Writer Service
export const generateText = asyncHandler(async (req, res) => {
  const { prompt, contentType, tone, length, language } = req.body;
  const userId = req.user._id;
  let service = null; // Declare service variable at function scope

  // Validation
  if (!prompt || !contentType) {
    throw new ApiError(400, "Prompt and content type are required");
  }

  try {
    // Check if user has active subscription (Free or Paid)
    const subscription = await Subscription.findOne({ userId });

    const hasActiveSubscription = subscription && subscription.isActive();

    // Get AI Text Writer service
    service = await Service.findOne({
      type: "ai_text_writer",
      status: "active",
    });
    if (!service) {
      throw new ApiError(404, "AI Text Writer service not available");
    }

    // Get today's usage
    const usageData = await getTodayUsage(
      userId,
      service._id,
      "wordsGenerated"
    );
    const wordsUsedToday = usageData.total;
    logger.info("Words used today", {
      userId: userId.toString(),
      wordsUsedToday,
    });

    // Get limits based on subscription (Free or Paid)
    let maxWords = DEFAULT_WORD_LIMIT;
    if (hasActiveSubscription && subscription.planId) {
      const plan = await SubscriptionPlan.findById(subscription.planId);
      if (plan && plan.features.aiTextWriter.enabled) {
        maxWords = plan.features.aiTextWriter.wordsPerDay;
      }
    }

    // For testing: Set default limit if 0
    if (maxWords === 0) {
      maxWords = DEFAULT_WORD_LIMIT;
    }

    // Estimate words based on length option
    const estimatedWords =
      WORD_ESTIMATES[length || "medium"] || WORD_ESTIMATES.medium;

    // Check usage limits using utility function
    const usageCheck = await checkUsageLimits({
      userId,
      serviceId: service._id,
      limitType: "words",
      currentUsage: wordsUsedToday,
      maxLimit: maxWords,
      estimatedUsage: estimatedWords,
      socketIO: req.socketIO,
      serviceName: "ai_text_writer",
    });

    if (!usageCheck.allowed) {
      throw new ApiError(403, usageCheck.message);
    }

    // Sanitize input (trim prompt)
    const sanitizedPrompt = prompt.trim();

    // Validate input using service
    const validation = aiTextWriterService.validateInput(
      sanitizedPrompt,
      contentType
    );
    if (!validation.isValid) {
      throw new ApiError(400, validation.errors.join(", "));
    }

    // Emit AI service start event
    if (req.socketIO) {
      req.socketIO.emitToUser(userId, "ai_text_generation_start", {
        contentType: contentType,
        prompt: sanitizedPrompt,
        timestamp: new Date(),
      });
    }

    // Generate text using service
    const result = await aiTextWriterService.generateText(
      sanitizedPrompt,
      contentType,
      {
        tone,
        length,
        language,
      }
    );

    logger.info("AI Text Generation Result", {
      success: result.success,
      hasContent: !!result.content,
      wordsGenerated: result.wordsGenerated,
      model: result.model,
      userId: userId.toString(),
    });

    if (!result.success) {
      throw new ApiError(500, `Text generation failed: ${result.error}`);
    }

    const generatedText = result.content;
    const wordsGenerated = result.wordsGenerated;

    // Save usage record
    const usageRecord = new ServiceUsage({
      userId: userId,
      serviceId: service._id,
      request: {
        type: contentType || "ai_text_writer",
        prompt: sanitizedPrompt,
        parameters: {
          contentType: contentType,
          tone: tone,
          length: length,
          language: language,
        },
        timestamp: new Date(),
      },
      response: {
        success: true,
        data: {
          content: generatedText,
          wordsGenerated: wordsGenerated,
        },
        timestamp: new Date(),
      },
    });

    try {
      await usageRecord.save();
      logger.info("ServiceUsage saved successfully", {
        userId: userId.toString(),
        serviceId: service._id.toString(),
        wordsGenerated,
      });
    } catch (saveError) {
      logger.error("ServiceUsage save error", {
        error: saveError.message,
        userId: userId.toString(),
      });
      throw saveError;
    }

    // Update service statistics with performance data
    await Service.findByIdAndUpdate(service._id, {
      $inc: {
        "statistics.totalRequests": 1,
        "statistics.successfulRequests": 1,
        "statistics.totalUsage": wordsGenerated,
      },
      $set: {
        "statistics.averageResponseTime": result.duration,
      },
    });

    // Emit AI service completion event
    if (req.socketIO) {
      req.socketIO.emitToUser(userId, "ai_service_complete", {
        service: "ai_text_writer",
        result: {
          contentType: contentType,
          wordsGenerated: wordsGenerated,
          duration: result.duration,
        },
        timestamp: new Date(),
      });
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          generatedText: generatedText,
          wordsGenerated: wordsGenerated,
          contentType: contentType,
          duration: result.duration,
          usage: {
            wordsUsedToday: wordsUsedToday + wordsGenerated,
            maxWords: maxWords,
            remainingWords: maxWords - (wordsUsedToday + wordsGenerated),
          },
        },
        "Text generated successfully"
      )
    );
  } catch (error) {
    logger.error("AI Text Generation Error", {
      error: error.message,
      userId: userId?.toString(),
      contentType,
    });

    // Save failed usage using utility function
    if (userId && service) {
      await saveFailedUsage({
        userId,
        serviceId: service._id,
        requestType: contentType || "ai_text_writer",
        requestData: {
          prompt: req.body.prompt?.trim() || "",
          parameters: {
            contentType,
            tone,
            length,
            language,
          },
        },
        error,
        errorCode: ERROR_CODES.TEXT_GENERATION_ERROR,
      });
    }

    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Text generation failed: ${error.message}`);
  }
});

// Get user's text generation history
export const getTextHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 10 } = req.query;

  const service = await Service.findOne({ type: "ai_text_writer" });
  if (!service) {
    throw new ApiError(404, "AI Text Writer service not found");
  }

  const skip = (page - 1) * limit;

  const history = await ServiceUsage.find({
    userId: userId,
    serviceId: service._id,
    "response.success": true,
  })
    .sort({ "request.timestamp": -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select("request response cost metadata createdAt");

  const total = await ServiceUsage.countDocuments({
    userId: userId,
    serviceId: service._id,
    "response.success": true,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        history: history,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / limit),
        },
      },
      "Text history retrieved successfully"
    )
  );
});

// Get usage statistics
export const getUsageStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const service = await Service.findOne({ type: "ai_text_writer" });
  if (!service) {
    throw new ApiError(404, "AI Text Writer service not found");
  }

  // Get today's usage
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayUsage = await ServiceUsage.aggregate([
    {
      $match: {
        userId: userId,
        serviceId: service._id,
        "request.timestamp": { $gte: today },
        "response.success": true,
      },
    },
    {
      $group: {
        _id: null,
        totalWords: { $sum: "$response.data.wordsGenerated" },
        totalRequests: { $sum: 1 },
      },
    },
  ]);

  // Get this month's usage
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const monthUsage = await ServiceUsage.aggregate([
    {
      $match: {
        userId: userId,
        serviceId: service._id,
        "request.timestamp": { $gte: monthStart },
        "response.success": true,
      },
    },
    {
      $group: {
        _id: null,
        totalWords: { $sum: "$response.data.wordsGenerated" },
        totalRequests: { $sum: 1 },
      },
    },
  ]);

  const user = await User.findById(userId);
  const subscription = await Subscription.findOne({ userId });

  const maxWords = subscription?.limits?.wordsPerDay || 500; // Default limit for testing
  const todayStats = todayUsage[0] || { totalWords: 0, totalRequests: 0 };
  const monthStats = monthUsage[0] || { totalWords: 0, totalRequests: 0 };

  // Check if unlimited (threshold >= 99999999)
  const UNLIMITED_THRESHOLD = 99999999;
  const isUnlimited = maxWords >= UNLIMITED_THRESHOLD;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        today: {
          wordsUsed: todayStats.totalWords,
          requests: todayStats.totalRequests,
          maxWords: maxWords,
          remainingWords: isUnlimited ? Infinity : maxWords - todayStats.totalWords,
          isUnlimited: isUnlimited,
        },
        thisMonth: {
          wordsUsed: monthStats.totalWords,
          requests: monthStats.totalRequests,
        },
        accountType: "subscription",
      },
      "Usage statistics retrieved successfully"
    )
  );
});

export const generateTextStream = async (req, res) => {
  const { prompt, contentType, tone, length, language } = req.body;
  const userId = req.user?._id;

  // Input validation - use SSE format for errors
  if (!prompt?.trim() || !contentType) {
    res.status(400);
    res.write(
      `data: ${JSON.stringify({
        error: "Prompt and content type are required",
      })}\n\n`
    );
    res.end();
    return;
  }

  // Set headers for Server-Sent Events
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable buffering in Nginx

  // Flush headers immediately (best practice for SSE)
  res.flushHeaders();

  // Handle client disconnect gracefully
  req.on("close", () => {
    console.log("🔌 Client disconnected from stream");
    if (!res.writableEnded) {
      res.end();
    }
  });

  let fullText = "";

  try {
    // CRITICAL: Check usage limits BEFORE generation starts
    // This prevents 100%+ usage (must be checked before SSE headers are sent)
    const subscription = await Subscription.findOne({ userId }).populate(
      "planId"
    );
    const hasActiveSubscription = subscription && subscription.isActive();

    const service = await Service.findOne({
      type: "ai_text_writer",
      status: "active",
    });
    if (!service) {
      res.write(
        `data: ${JSON.stringify({
          error: "AI Text Writer service not available",
        })}\n\n`
      );
      res.end();
      return;
    }

    // Get today's usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayUsage = await ServiceUsage.aggregate([
      {
        $match: {
          userId: userId,
          serviceId: service._id,
          "request.timestamp": { $gte: today },
          "response.success": true,
        },
      },
      {
        $group: {
          _id: null,
          totalWords: { $sum: "$response.data.wordsGenerated" },
        },
      },
    ]);

    // Get today's usage
    const usageData = await getTodayUsage(
      userId,
      service._id,
      "wordsGenerated"
    );
    const wordsUsedToday = usageData.total;
    logger.info("Stream: Words used today", {
      userId: userId.toString(),
      wordsUsedToday,
    });

    // Get limits based on subscription
    let maxWords = DEFAULT_WORD_LIMIT;
    if (hasActiveSubscription && subscription.planId) {
      const plan = subscription.planId;
      if (plan && plan.features?.aiTextWriter?.enabled) {
        maxWords = plan.features.aiTextWriter.wordsPerDay;
      }
    }

    // For testing: Set default limit if 0
    if (maxWords === 0) {
      maxWords = DEFAULT_WORD_LIMIT;
    }

    // Estimate words based on length option
    const estimatedWords =
      WORD_ESTIMATES[length || "medium"] || WORD_ESTIMATES.medium;

    // Check usage limits using utility function
    const usageCheck = await checkUsageLimits({
      userId,
      serviceId: service._id,
      limitType: "words",
      currentUsage: wordsUsedToday,
      maxLimit: maxWords,
      estimatedUsage: estimatedWords,
      socketIO: req.socketIO,
      serviceName: "ai_text_writer",
    });

    if (!usageCheck.allowed) {
      res.write(
        `data: ${JSON.stringify({
          error: usageCheck.message,
          limitExceeded: usageCheck.reason === "limit_exceeded",
          limitWarning: usageCheck.reason === "insufficient_remaining",
          usage: usageCheck.usage,
        })}\n\n`
      );
      res.end();
      return;
    }

    // Sanitize input
    const sanitizedPrompt = prompt.trim();

    // Validate input using service
    const validation = aiTextWriterService.validateInput(
      sanitizedPrompt,
      contentType
    );
    if (!validation.isValid) {
      res.write(
        `data: ${JSON.stringify({
          error: validation.errors.join(", "),
        })}\n\n`
      );
      res.end();
      return;
    }

    // Emit AI service start event (optional - for Socket.IO notifications)
    if (req.socketIO && userId) {
      req.socketIO.emitToUser(userId, "ai_text_generation_start", {
        contentType: contentType,
        prompt: sanitizedPrompt,
        mode: "streaming",
        timestamp: new Date(),
      });
    }

    // Start streaming generator
    const stream = aiTextWriterService.generateTextStream(
      sanitizedPrompt,
      contentType,
      {
        tone,
        length,
        language,
      }
    );

    // Process generator: only strings are yielded, final object is returned
    for await (const chunk of stream) {
      // Generator yields only strings - no object checks needed
      if (typeof chunk === "string") {
        fullText += chunk;
        // Send chunk to client immediately
        res.write(`data: ${JSON.stringify({ chunk, partial: fullText })}\n\n`);
      }
      // Note: Final result object comes as return value, not yield
    }

    // Get final result from generator return value
    // In async generators, the return value is accessed after loop completes
    // But we can't directly access it, so we calculate from fullText
    const trimmedText = fullText.trim();
    const wordsGenerated = trimmedText
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    // Save usage record only if user is authenticated and text was generated
    if (!userId) {
      logger.warn("Stream: No userId found, skipping usage save");
    } else if (trimmedText.length > 0 && wordsGenerated > 0) {
      try {
        const service = await Service.findOne({ type: "ai_text_writer" });

        if (!service) {
          logger.error("Stream: AI Text Writer service not found");
        } else {
          const usageRecord = new ServiceUsage({
            userId: userId,
            serviceId: service._id,
            request: {
              type: contentType || "ai_text_writer",
              prompt: sanitizedPrompt,
              parameters: {
                contentType,
                tone,
                length,
                language,
                mode: "streaming",
              },
              timestamp: new Date(),
            },
            response: {
              success: true,
              data: {
                content: trimmedText,
                wordsGenerated: wordsGenerated,
              },
              timestamp: new Date(),
            },
          });
          await usageRecord.save();
          logger.info("Stream ServiceUsage saved successfully", {
            wordsGenerated,
            userId: userId.toString(),
            serviceId: service._id.toString(),
          });

          // Emit completion event with updated usage
          const finalWordsUsed = wordsUsedToday + wordsGenerated;
          const finalUsagePercentage = Math.round(
            (finalWordsUsed / maxWords) * 100
          );

          if (req.socketIO) {
            req.socketIO.emitToUser(userId, "ai_service_complete", {
              service: "ai_text_writer",
              contentType: contentType,
              wordsGenerated: wordsGenerated,
              mode: "streaming",
              timestamp: new Date(),
            });

            // Emit updated usage after generation
            req.socketIO.emitToUser(userId, "usage_updated", {
              service: "ai_text_writer",
              usage: {
                used: finalWordsUsed,
                limit: maxWords,
                percentage: finalUsagePercentage,
                remaining: Math.max(0, maxWords - finalWordsUsed),
              },
              message:
                finalUsagePercentage >= 100
                  ? `🚫 You've reached your daily limit (${maxWords} words)`
                  : finalUsagePercentage >= 95
                  ? `⚠️ You've used ${finalUsagePercentage}% of your daily limit!`
                  : `📊 You've used ${finalUsagePercentage}% of your daily limit.`,
              timestamp: new Date(),
            });

            // Emit warning if now at 80%+ threshold
            if (finalUsagePercentage >= 80) {
              req.socketIO.emitToUser(userId, "usage_warning", {
                service: "ai_text_writer",
                usage: {
                  used: finalWordsUsed,
                  limit: maxWords,
                  percentage: finalUsagePercentage,
                  remaining: Math.max(0, maxWords - finalWordsUsed),
                },
                message:
                  finalUsagePercentage >= 100
                    ? `🚫 You've reached your daily limit!`
                    : finalUsagePercentage >= 95
                    ? `⚠️ You've used ${finalUsagePercentage}% of your daily limit!`
                    : `📊 You've used ${finalUsagePercentage}% of your daily limit.`,
                timestamp: new Date(),
              });
            }
          }
        }
      } catch (saveError) {
        logger.error("Streaming ServiceUsage save error", {
          error: saveError.message,
          userId: userId?.toString(),
        });
        // Don't fail the stream if saving fails
      }
    } else {
      logger.warn("Stream: No text generated, skipping usage save", {
        fullTextLength: fullText?.length || 0,
        wordsGenerated,
      });
    }

    // Send completion signal with final data
    res.write(
      `data: ${JSON.stringify({
        done: true,
        fullText: trimmedText,
        wordsGenerated,
        contentType,
        success: true,
      })}\n\n`
    );
  } catch (error) {
    logger.error("Streaming error", {
      error: error.message,
      userId: userId?.toString(),
    });
    // Send error via SSE format
    res.write(
      `data: ${JSON.stringify({
        error: error.message || "An error occurred during text generation",
      })}\n\n`
    );
  } finally {
    // Always end the stream
    if (!res.writableEnded) {
      res.end();
    }
  }
};

// Get AI Text Writer service options
export const getTextWriterOptions = asyncHandler(async (req, res) => {
  const contentTypes = aiTextWriterService.getContentTypes();
  const tones = aiTextWriterService.getTones();
  const lengths = aiTextWriterService.getLengths();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        contentTypes: contentTypes,
        tones: tones,
        lengths: lengths,
      },
      "Service options retrieved successfully"
    )
  );
});

// ========================================
// AI IMAGE GENERATOR SERVICE
// ========================================

// Generate AI Image
export const generateImage = asyncHandler(async (req, res) => {
  const { prompt, size, quality, style } = req.body;
  const userId = req.user._id;
  let service = null;

  // Validation
  if (!prompt) {
    throw new ApiError(400, "Prompt is required");
  }

  try {
    // Sanitize input
    const sanitizedPrompt = prompt.trim();

    // Validate prompt
    aiImageGeneratorService.validatePrompt(sanitizedPrompt);

    // Check if user has active subscription
    const subscription = await Subscription.findOne({ userId });
    const hasActiveSubscription = subscription && subscription.isActive();

    // Get AI Image Generator service
    service = await Service.findOne({
      type: "ai_image_generator",
      status: "active",
    });
    if (!service) {
      throw new ApiError(404, "AI Image Generator service not available");
    }

    // Get today's usage
    const imageUsageData = await getTodayUsage(
      userId,
      service._id,
      "imagesGenerated"
    );
    const imagesUsedToday = imageUsageData.total;
    logger.info("Images used today", {
      userId: userId.toString(),
      imagesUsedToday,
    });

    // Get limits based on subscription
    let maxImages = DEFAULT_IMAGE_LIMIT;
    if (hasActiveSubscription && subscription.planId) {
      const plan = await SubscriptionPlan.findById(subscription.planId);
      if (plan && plan.features.aiImageGenerator.enabled) {
        maxImages = plan.features.aiImageGenerator.imagesPerDay;
      }
    }

    // For testing: Set default limit if 0
    if (maxImages === 0) {
      maxImages = DEFAULT_IMAGE_LIMIT;
    }

    // Check usage limits (images don't have estimated usage, so pass 0)
    const usageCheck = await checkUsageLimits({
      userId,
      serviceId: service._id,
      limitType: "images",
      currentUsage: imagesUsedToday,
      maxLimit: maxImages,
      estimatedUsage: 0, // Images are always 1 per request
      socketIO: req.socketIO,
      serviceName: "ai_image_generator",
    });

    if (!usageCheck.allowed) {
      throw new ApiError(403, usageCheck.message);
    }

    const startTime = Date.now();

    // Generate image (with storage enabled)
    const imageResult = await aiImageGeneratorService.generateImage(
      sanitizedPrompt,
      {
        size: size || "1024x1024",
        quality: quality || "standard",
        style: style || "vivid",
        saveToStorage: true, // Always save to permanent storage
        userId: userId.toString(), // Pass userId for organizing images
      }
    );

    const duration = Date.now() - startTime;

    // Save usage record
    const imageServiceUsageData = {
      userId: userId,
      serviceId: service._id,
      request: {
        type: "image_generation", // Required field
        prompt: sanitizedPrompt,
        parameters: {
          size: imageResult.size,
          quality: imageResult.quality,
          style: imageResult.style,
        },
        timestamp: new Date(),
      },
      response: {
        success: true,
        data: {
          imageUrl: imageResult.imageUrl, // Permanent URL
          dalleImageUrl: imageResult.dalleImageUrl, // Original DALL·E URL (may expire)
          revisedPrompt: imageResult.revisedPrompt,
          imagesGenerated: 1,
          size: imageResult.size,
          quality: imageResult.quality,
          style: imageResult.style,
          isStored: imageResult.isStored || false,
          storageInfo: imageResult.storageInfo || null,
        },
        responseTime: duration, // Use responseTime as per model schema
        timestamp: new Date(),
      },
      cost: {
        amount: calculateImageCost(
          imageResult.provider || "pollinations",
          imageResult.size,
          imageResult.quality
        ),
        currency: "USD",
      },
      metadata: {
        model: imageResult.model,
        isMock: imageResult.isMock || false,
      },
    };

    const serviceUsage = new ServiceUsage(imageServiceUsageData);
    await serviceUsage.save();
    logger.info("ServiceUsage saved successfully for image generation", {
      userId: userId.toString(),
      serviceId: service._id.toString(),
    });

    // Update remaining images
    const remainingImages = maxImages - (imagesUsedToday + 1);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          imageUrl: imageResult.imageUrl, // Relative path (e.g., "/generated-images/userId/file.png")
          fullUrl: imageResult.fullUrl || imageResult.imageUrl, // Full URL with host and port (e.g., "http://localhost:5000/generated-images/userId/file.png")
          dalleImageUrl: imageResult.dalleImageUrl, // Original DALL·E URL
          revisedPrompt: imageResult.revisedPrompt,
          originalPrompt: imageResult.originalPrompt || sanitizedPrompt,
          size: imageResult.size,
          quality: imageResult.quality,
          style: imageResult.style,
          duration: duration,
          isStored: imageResult.isStored || false, // Whether saved to permanent storage
          cost: calculateImageCost(
            imageResult.provider || "pollinations",
            imageResult.size,
            imageResult.quality
          ),
          usage: {
            imagesUsedToday: imagesUsedToday + 1,
            maxImages: maxImages,
            remainingImages: remainingImages,
          },
        },
        "Image generated successfully"
      )
    );
  } catch (error) {
    logger.error("Image generation error", {
      error: error.message,
      userId: userId?.toString(),
    });

    // Save failed usage record using utility function
    if (service && userId) {
      await saveFailedUsage({
        userId,
        serviceId: service._id,
        requestType: "image_generation",
        requestData: {
          prompt: req.body.prompt?.trim() || "",
          parameters: {
            size: size || "1024x1024",
            quality: quality || "standard",
            style: style || "vivid",
          },
        },
        error,
        errorCode: ERROR_CODES.IMAGE_GENERATION_FAILED,
      });
    }

    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Image generation failed: ${error.message}`);
  }
});

// Get user's image generation history
export const getImageHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 10 } = req.query;

  const service = await Service.findOne({ type: "ai_image_generator" });
  if (!service) {
    throw new ApiError(404, "AI Image Generator service not found");
  }

  const skip = (page - 1) * limit;

  const history = await ServiceUsage.find({
    userId: userId,
    serviceId: service._id,
    "response.success": true,
  })
    .sort({ "request.timestamp": -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select("request response cost metadata createdAt");

  const total = await ServiceUsage.countDocuments({
    userId: userId,
    serviceId: service._id,
    "response.success": true,
  });

  // Transform history items to include fullUrl for each image
  const transformedHistory = history.map((item) => {
    const responseData = item.response?.data || {};

    // Construct fullUrl if not already present
    let fullUrl = responseData.fullUrl;
    if (!fullUrl && responseData.imageUrl) {
      // If imageUrl is relative path, construct full URL
      if (responseData.imageUrl.startsWith("/")) {
        fullUrl = getImageUrl(responseData.imageUrl);
      } else if (
        responseData.imageUrl.startsWith("http://") ||
        responseData.imageUrl.startsWith("https://")
      ) {
        // Already a full URL (e.g., placeholder URLs)
        fullUrl = responseData.imageUrl;
      }
    }

    // Return item with updated response.data including fullUrl
    return {
      ...item.toObject(),
      response: {
        ...item.response,
        data: {
          ...responseData,
          fullUrl: fullUrl || responseData.imageUrl, // Ensure fullUrl is always present
        },
      },
    };
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        history: transformedHistory,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / limit),
        },
      },
      "Image history retrieved successfully"
    )
  );
});

// Get image generation usage statistics
export const getImageStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const service = await Service.findOne({ type: "ai_image_generator" });
  if (!service) {
    throw new ApiError(404, "AI Image Generator service not found");
  }

  // Get today's usage
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayUsage = await ServiceUsage.aggregate([
    {
      $match: {
        userId: userId,
        serviceId: service._id,
        "request.timestamp": { $gte: today },
        "response.success": true,
      },
    },
    {
      $group: {
        _id: null,
        totalImages: { $sum: "$response.data.imagesGenerated" },
        totalRequests: { $sum: 1 },
      },
    },
  ]);

  // Get this month's usage
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const monthUsage = await ServiceUsage.aggregate([
    {
      $match: {
        userId: userId,
        serviceId: service._id,
        "request.timestamp": { $gte: monthStart },
        "response.success": true,
      },
    },
    {
      $group: {
        _id: null,
        totalImages: { $sum: "$response.data.imagesGenerated" },
        totalRequests: { $sum: 1 },
      },
    },
  ]);

  const subscription = await Subscription.findOne({ userId });

  const maxImages = subscription?.limits?.aiImageGenerator?.imagesPerDay || 3; // Default limit
  const todayStats = todayUsage[0] || { totalImages: 0, totalRequests: 0 };
  const monthStats = monthUsage[0] || { totalImages: 0, totalRequests: 0 };

  // Check if unlimited (threshold >= 99999999)
  const UNLIMITED_THRESHOLD = 99999999;
  const isUnlimited = maxImages >= UNLIMITED_THRESHOLD;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        today: {
          imagesUsed: todayStats.totalImages,
          requests: todayStats.totalRequests,
          maxImages: maxImages,
          remainingImages: isUnlimited ? Infinity : maxImages - todayStats.totalImages,
          isUnlimited: isUnlimited,
        },
        thisMonth: {
          imagesUsed: monthStats.totalImages,
          requests: monthStats.totalRequests,
        },
        accountType: "subscription",
      },
      "Image usage statistics retrieved successfully"
    )
  );
});

// Get AI Image Generator service options
export const getImageOptions = asyncHandler(async (req, res) => {
  const sizes = aiImageGeneratorService.getSupportedSizes();
  const qualities = aiImageGeneratorService.getSupportedQualities();
  const styles = aiImageGeneratorService.getSupportedStyles();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        sizes: sizes,
        qualities: qualities,
        styles: styles,
      },
      "Image generator options retrieved successfully"
    )
  );
});

// ========================================
// AI VIDEO GENERATOR SERVICE
// ========================================

// Calculate video generation cost based on provider, duration and resolution
const calculateVideoCost = (provider, duration, resolution) => {
  // Qwen API pricing (approximate - adjust based on actual pricing)
  // Videos are more expensive than images
  const baseCost = 0.5; // Base cost per video
  const durationMultiplier = duration / 5; // Cost increases with duration
  const resolutionMultiplier = resolution === "1080p" ? 1.5 : 1.0;

  return baseCost * durationMultiplier * resolutionMultiplier;
};

// Generate AI Video
export const generateVideo = asyncHandler(async (req, res) => {
  const { prompt, duration, resolution, aspectRatio, fps, style } = req.body;
  const userId = req.user._id;
  let service = null;

  // Validation
  if (!prompt) {
    throw new ApiError(400, "Prompt is required");
  }

  try {
    // Sanitize input
    const sanitizedPrompt = prompt.trim();

    // Validate prompt
    aiVideoGeneratorService.validatePrompt(sanitizedPrompt);

    // Check if user has active subscription
    const subscription = await Subscription.findOne({ userId });
    const hasActiveSubscription = subscription && subscription.isActive();

    // Get AI Video Generator service
    service = await Service.findOne({
      type: "ai_video_generator",
      status: "active",
    });
    if (!service) {
      throw new ApiError(404, "AI Video Generator service not available");
    }

    // Get today's usage
    const videoUsageData = await getTodayUsage(
      userId,
      service._id,
      "videosGenerated"
    );
    const videosUsedToday = videoUsageData.total;
    logger.info("Videos used today", {
      userId: userId.toString(),
      videosUsedToday,
    });

    // Get limits based on subscription
    let maxVideos = DEFAULT_VIDEO_LIMIT;
    if (hasActiveSubscription && subscription.planId) {
      const plan = await SubscriptionPlan.findById(subscription.planId);
      if (plan && plan.features.aiVideoGenerator?.enabled) {
        maxVideos =
          plan.features.aiVideoGenerator.videosPerDay || DEFAULT_VIDEO_LIMIT;
      }
    }

    // For testing: Set default limit if 0
    if (maxVideos === 0) {
      maxVideos = DEFAULT_VIDEO_LIMIT;
    }

    // Check usage limits
    const usageCheck = await checkUsageLimits({
      userId,
      serviceId: service._id,
      limitType: "videos",
      currentUsage: videosUsedToday,
      maxLimit: maxVideos,
      estimatedUsage: 0, // Videos are always 1 per request
      socketIO: req.socketIO,
      serviceName: "ai_video_generator",
    });

    if (!usageCheck.allowed) {
      throw new ApiError(403, usageCheck.message);
    }

    const startTime = Date.now();

    // Generate video (with storage enabled)
    const videoResult = await aiVideoGeneratorService.generateVideo(
      sanitizedPrompt,
      {
        duration: duration || 5,
        resolution: resolution || "720p",
        aspectRatio: aspectRatio || "16:9",
        fps: fps || 24,
        style: style || "cinematic",
        saveToStorage: true, // Always save to permanent storage
        userId: userId.toString(), // Pass userId for organizing videos
      }
    );

    const generationTime = Date.now() - startTime;

    // Save usage record
    const videoServiceUsageData = {
      userId: userId,
      serviceId: service._id,
      request: {
        type: "video_generation",
        prompt: sanitizedPrompt,
        parameters: {
          duration: videoResult.duration,
          resolution: videoResult.resolution,
          aspectRatio: videoResult.aspectRatio,
          fps: videoResult.fps,
          style: videoResult.style,
        },
        timestamp: new Date(),
      },
      response: {
        success: true,
        data: {
          videoUrl: videoResult.videoUrl,
          originalVideoUrl: videoResult.originalVideoUrl,
          revisedPrompt: videoResult.revisedPrompt,
          videosGenerated: 1,
          duration: videoResult.duration,
          resolution: videoResult.resolution,
          aspectRatio: videoResult.aspectRatio,
          fps: videoResult.fps,
          style: videoResult.style,
          isStored: videoResult.isStored || false,
          storageInfo: videoResult.storageInfo || null,
        },
        responseTime: generationTime,
        timestamp: new Date(),
      },
      cost: {
        amount: calculateVideoCost(
          videoResult.provider || "qwen",
          videoResult.duration,
          videoResult.resolution
        ),
        currency: "USD",
      },
      metadata: {
        model: videoResult.model,
        isMock: videoResult.isMock || false,
      },
    };

    const serviceUsage = new ServiceUsage(videoServiceUsageData);
    await serviceUsage.save();
    logger.info("ServiceUsage saved successfully for video generation", {
      userId: userId.toString(),
      serviceId: service._id.toString(),
    });

    // Update remaining videos (handle unlimited)
    const UNLIMITED_THRESHOLD = 99999999;
    const isUnlimited = maxVideos >= UNLIMITED_THRESHOLD;
    const remainingVideos = isUnlimited ? Infinity : maxVideos - (videosUsedToday + 1);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          videoUrl: videoResult.videoUrl,
          fullUrl: videoResult.fullUrl || videoResult.videoUrl,
          originalVideoUrl: videoResult.originalVideoUrl,
          revisedPrompt: videoResult.revisedPrompt,
          originalPrompt: videoResult.originalPrompt || sanitizedPrompt,
          duration: videoResult.duration,
          resolution: videoResult.resolution,
          aspectRatio: videoResult.aspectRatio,
          fps: videoResult.fps,
          style: videoResult.style,
          generationTime: generationTime,
          isStored: videoResult.isStored || false,
          cost: calculateVideoCost(
            videoResult.provider || "qwen",
            videoResult.duration,
            videoResult.resolution
          ),
          usage: {
            videosUsedToday: videosUsedToday + 1,
            maxVideos: maxVideos,
            remainingVideos: remainingVideos,
            isUnlimited: isUnlimited,
          },
        },
        "Video generated successfully"
      )
    );
  } catch (error) {
    logger.error("Video generation error", {
      error: error.message,
      userId: userId?.toString(),
    });

    // Save failed usage record
    if (service && userId) {
      await saveFailedUsage({
        userId,
        serviceId: service._id,
        requestType: "video_generation",
        requestData: {
          prompt: req.body.prompt?.trim() || "",
          parameters: {
            duration: duration || 5,
            resolution: resolution || "720p",
            aspectRatio: aspectRatio || "16:9",
            fps: fps || 24,
            style: style || "cinematic",
          },
        },
        error,
        errorCode:
          ERROR_CODES.VIDEO_GENERATION_FAILED || "VIDEO_GENERATION_FAILED",
      });
    }

    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Video generation failed: ${error.message}`);
  }
});

// Get user's video generation history
export const getVideoHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 10 } = req.query;

  const service = await Service.findOne({ type: "ai_video_generator" });
  if (!service) {
    throw new ApiError(404, "AI Video Generator service not found");
  }

  const skip = (page - 1) * limit;

  const history = await ServiceUsage.find({
    userId: userId,
    serviceId: service._id,
    "response.success": true,
  })
    .sort({ "request.timestamp": -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select("request response cost metadata createdAt");

  const total = await ServiceUsage.countDocuments({
    userId: userId,
    serviceId: service._id,
    "response.success": true,
  });

  // Transform history items to include fullUrl for each video
  const transformedHistory = history.map((item) => {
    const responseData = item.response?.data || {};

    // Construct fullUrl if not already present
    let fullUrl = responseData.fullUrl;
    if (!fullUrl && responseData.videoUrl) {
      if (responseData.videoUrl.startsWith("/")) {
        fullUrl = getImageUrl(responseData.videoUrl); // Reuse image URL utility
      } else if (
        responseData.videoUrl.startsWith("http://") ||
        responseData.videoUrl.startsWith("https://")
      ) {
        fullUrl = responseData.videoUrl;
      } else {
        fullUrl = getImageUrl(
          `/generated-videos/${userId}/${responseData.videoUrl}`
        );
      }
    }

    return {
      _id: item._id,
      request: {
        prompt: item.request?.prompt,
        parameters: item.request?.parameters,
        timestamp: item.request?.timestamp,
      },
      response: {
        ...responseData,
        fullUrl: fullUrl || responseData.videoUrl,
      },
      cost: item.cost,
      metadata: item.metadata,
      createdAt: item.createdAt,
    };
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        history: transformedHistory,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / limit),
        },
      },
      "Video history retrieved successfully"
    )
  );
});

// Get Video Generation Options (Resolutions, Durations, Styles, Aspect Ratios)
export const getVideoOptions = asyncHandler(async (req, res) => {
  const resolutions = aiVideoGeneratorService.getSupportedResolutions();
  const durations = aiVideoGeneratorService.getSupportedDurations();
  const aspectRatios = aiVideoGeneratorService.getSupportedAspectRatios();
  const styles = aiVideoGeneratorService.getSupportedStyles();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        resolutions: resolutions,
        durations: durations,
        aspectRatios: aspectRatios,
        styles: styles,
      },
      "Video generator options retrieved successfully"
    )
  );
});
