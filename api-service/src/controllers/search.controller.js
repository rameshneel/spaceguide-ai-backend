import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  semanticSearch,
  indexDocument,
  indexDocuments,
  deleteDocument,
  getCollectionStats,
} from "../services/ai/services/search/searchService.js";
import ServiceUsage from "../models/serviceUsage.model.js";
import Service from "../models/service.model.js";
import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";
import { getTodayUsage } from "../utils/index.js";
import { checkSearchAccess } from "../middleware/usageLimit.middleware.js";
import { safeLogger as logger } from "../utils/logger.js";

/**
 * Perform AI Search
 * POST /api/services/search
 * body: { query: string, limit?: number }
 */
export const search = asyncHandler(async (req, res) => {
  const { query, limit = 10 } = req.body;
  const userId = req.user?._id;
  let service = null;

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    throw new ApiError(400, "Search query is required");
  }

  if (limit < 1 || limit > 50) {
    throw new ApiError(400, "Limit must be between 1 and 50");
  }

  try {
    // Get AI Search service
    service = await Service.findOne({
      type: "ai_search",
      status: "active",
    });
    if (!service) {
      throw new ApiError(404, "AI Search service not available");
    }

    // Check subscription and limits
    const subscription = await Subscription.findOne({ userId });
    const hasActiveSubscription = subscription && subscription.isActive();

    // Get today's usage
    const usageData = await getTodayUsage(
      userId,
      service._id,
      "searchesPerDay"
    );
    const searchesUsedToday = usageData.total;

    // Get limits based on subscription
    let maxSearches = 10; // Default free limit
    if (hasActiveSubscription && subscription.planId) {
      const plan = await SubscriptionPlan.findById(subscription.planId);
      if (plan && plan.features.aiSearch?.enabled) {
        maxSearches = plan.features.aiSearch.searchesPerDay || 10;
      }
    }

    // Check if user has exceeded daily limit (skip if unlimited)
    const UNLIMITED_THRESHOLD = 99999999;
    const isUnlimited = maxSearches >= UNLIMITED_THRESHOLD;
    
    if (!isUnlimited && searchesUsedToday >= maxSearches) {
      throw new ApiError(
        429,
        `Daily search limit reached (${maxSearches} searches/day). Please upgrade your plan for more searches.`
      );
    }

    // Perform search
    const results = await semanticSearch(query.trim(), limit);

    // Format response
    const formattedResults = results.map((result) => ({
      id: result.id,
      content: result.content,
      metadata: result.metadata,
      score: result.score,
    }));

    // Save usage record
    const usageRecord = new ServiceUsage({
      userId,
      serviceId: service._id,
      request: {
        type: "ai_search",
        query: query.trim(),
        limit,
        timestamp: new Date(),
      },
      response: {
        success: true,
        data: {
          searchesPerDay: 1,
          resultsCount: formattedResults.length,
        },
        timestamp: new Date(),
      },
    });

    await usageRecord.save();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          {
            query: query.trim(),
            results: formattedResults,
            total: formattedResults.length,
            usage: {
              searchesUsedToday: searchesUsedToday + 1,
              searchesLimit: maxSearches,
            },
          },
          "Search completed successfully"
        )
      );
  } catch (error) {
    // Save failed usage if service exists
    if (service && userId) {
      try {
        const failedUsage = new ServiceUsage({
          userId,
          serviceId: service._id,
          request: {
            type: "ai_search",
            query: query.trim(),
            limit,
            timestamp: new Date(),
          },
          response: {
            success: false,
            error: error.message,
            timestamp: new Date(),
          },
        });
        await failedUsage.save();
      } catch (saveError) {
        logger.error("Failed to save search usage:", saveError);
      }
    }

    logger.error("Search error:", error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, error.message || "Search failed");
  }
});

/**
 * Index a document for search (Admin/Internal use)
 * POST /api/services/search/index
 * body: { content: string, metadata?: Object }
 */
export const indexDoc = asyncHandler(async (req, res) => {
  const { content, metadata = {} } = req.body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    throw new ApiError(400, "Document content is required");
  }

  try {
    const docId = await indexDocument(content.trim(), metadata);

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          { documentId: docId },
          "Document indexed successfully"
        )
      );
  } catch (error) {
    logger.error("Indexing error:", error);
    throw new ApiError(500, error.message || "Failed to index document");
  }
});

/**
 * Index multiple documents (Admin/Internal use)
 * POST /api/services/search/index-batch
 * body: { documents: Array<{content: string, metadata?: Object}> }
 */
export const indexDocsBatch = asyncHandler(async (req, res) => {
  const { documents } = req.body;

  if (!Array.isArray(documents) || documents.length === 0) {
    throw new ApiError(400, "Documents array is required");
  }

  if (documents.length > 100) {
    throw new ApiError(400, "Maximum 100 documents per batch");
  }

  try {
    const docIds = await indexDocuments(documents);

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          { documentIds: docIds, count: docIds.length },
          "Documents indexed successfully"
        )
      );
  } catch (error) {
    logger.error("Batch indexing error:", error);
    throw new ApiError(500, error.message || "Failed to index documents");
  }
});

/**
 * Get search collection statistics
 * GET /api/services/search/stats
 */
export const getStats = asyncHandler(async (req, res) => {
  try {
    const stats = await getCollectionStats();

    return res
      .status(200)
      .json(
        new ApiResponse(200, stats, "Statistics retrieved successfully")
      );
  } catch (error) {
    logger.error("Stats error:", error);
    throw new ApiError(500, error.message || "Failed to get statistics");
  }
});

