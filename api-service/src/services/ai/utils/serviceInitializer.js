import Service from "../../../models/service.model.js";
import { safeLogger as logger } from "../../../utils/logger.js";

// Initialize AI Text Writer Service in Database
export const initializeAITextWriterService = async () => {
  try {
    // Check if service already exists
    const existingService = await Service.findOne({ type: "ai_text_writer" });
    if (existingService) {
      logger.info("✅ AI Text Writer service already exists");
      return existingService;
    }

    // Create new service
    const service = new Service({
      name: "AI Text Writer",
      type: "ai_text_writer",
      description:
        "Generate high-quality text content using AI for blogs, social media, emails, and more",
      category: "AI Content Generation",

      // API Configuration
      apiConfig: {
        provider: "openai",
        apiKey: process.env.OPENAI_API_KEY || "sk-your-openai-api-key",
        baseUrl: "https://api.openai.com/v1",
        endpoints: {
          generate: "chat/completions",
          status: "models",
          webhook: "webhooks",
        },
      },

      // Service Status
      status: "active",

      // Usage Limits
      limits: {
        dailyRequests: 100,
        monthlyRequests: 3000,
        maxTokensPerRequest: 1000,
      },

      // Pricing
      pricing: {
        free: {
          wordsPerDay: 500,
          requestsPerDay: 10,
        },
        paid: {
          wordsPerDay: 10000,
          requestsPerDay: 100,
        },
      },

      // Features
      features: [
        "Blog post generation",
        "Social media content",
        "Email writing",
        "Product descriptions",
        "Ad copy creation",
        "Multiple content types",
        "Tone customization",
        "Length control",
        "Language support",
      ],

      // Statistics
      statistics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalUsage: 0,
        averageResponseTime: 0,
      },

      // Configuration
      config: {
        defaultModel: "gpt-3.5-turbo",
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30000,
      },
    });

    await service.save();
    logger.info("✅ AI Text Writer service created successfully");
    return service;
  } catch (error) {
    logger.error("❌ Error creating AI Text Writer service:", error);
    throw error;
  }
};

// Initialize AI Image Generator Service in Database
export const initializeAIImageGeneratorService = async () => {
  try {
    // Check if service already exists
    const existingService = await Service.findOne({
      type: "ai_image_generator",
    });
    if (existingService) {
      logger.info("✅ AI Image Generator service already exists");
      return existingService;
    }

    // Create new service
    const service = new Service({
      name: "AI Image Generator",
      type: "ai_image_generator",
      description:
        "Generate high-quality images from text prompts using DALL·E 3",
      category: "AI Content Generation",

      // API Configuration
      apiConfig: {
        provider: "openai",
        apiKey: process.env.OPENAI_API_KEY || "sk-your-openai-api-key",
        baseUrl: "https://api.openai.com/v1",
        endpoints: {
          generate: "images/generations",
          status: "models",
        },
      },

      // Service Status
      status: "active",

      // Usage Limits
      limits: {
        dailyRequests: 50,
        monthlyRequests: 1500,
        maxImagesPerRequest: 1, // DALL·E 3 supports 1 image per request
      },

      // Pricing
      pricing: {
        free: {
          imagesPerDay: 3,
          requestsPerDay: 3,
        },
        paid: {
          imagesPerDay: 100,
          requestsPerDay: 100,
        },
      },

      // Features
      features: [
        "Multiple provider support (Pollinations, Hugging Face, DALL·E 3)",
        "Multiple image sizes",
        "HD quality option",
        "8 style options (vivid, natural, realistic, artistic, anime, 3d-render, oil-painting, watercolor)",
        "Prompt revision",
        "High-quality image generation",
        "Free tier support for development",
        "Permanent image storage",
      ],

      // Statistics
      statistics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalImages: 0,
        averageResponseTime: 0,
      },

      // Configuration
      config: {
        defaultModel: "dall-e-3",
        defaultSize: "1024x1024",
        defaultQuality: "standard",
        defaultStyle: "vivid",
        timeout: 60000, // 60 seconds
      },
    });

    await service.save();
    logger.info("✅ AI Image Generator service created successfully");
    return service;
  } catch (error) {
    logger.error("❌ Error creating AI Image Generator service:", error);
    throw error;
  }
};

// Initialize AI Video Generator Service in Database
export const initializeAIVideoGeneratorService = async () => {
  try {
    // Check if service already exists
    const existingService = await Service.findOne({
      type: "ai_video_generator",
    });
    if (existingService) {
      logger.info("✅ AI Video Generator service already exists");
      return existingService;
    }

    // Create new service
    const service = new Service({
      name: "AI Video Generator",
      type: "ai_video_generator",
      description:
        "Generate high-quality videos from text prompts using Qwen API",
      category: "AI Content Generation",

      // API Configuration
      apiConfig: {
        provider: "qwen",
        apiKey: process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || "sk-your-qwen-api-key",
        baseUrl: "https://dashscope.aliyuncs.com/api/v1",
        endpoints: {
          generate: "services/aigc/video-generation/generation",
          status: "tasks",
        },
      },

      // Service Status
      status: "active",

      // Usage Limits
      limits: {
        dailyRequests: 20,
        monthlyRequests: 600,
        maxVideosPerRequest: 1, // Videos are resource-intensive
      },

      // Pricing
      pricing: {
        free: {
          videosPerDay: 1,
          requestsPerDay: 1,
        },
        paid: {
          videosPerDay: 10,
          requestsPerDay: 10,
        },
      },

      // Features
      features: [
        "Qwen API integration for video generation",
        "Multiple resolutions (720p, 1080p)",
        "Multiple durations (3s, 5s, 10s, 15s, 30s)",
        "Multiple aspect ratios (16:9, 9:16, 1:1)",
        "6 style options (cinematic, realistic, artistic, animated, documentary, futuristic)",
        "Customizable FPS (15-60)",
        "Permanent video storage",
        "Async task polling for long-running generations",
      ],

      // Statistics
      statistics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalVideos: 0,
        averageResponseTime: 0,
      },

      // Configuration
      config: {
        defaultModel: "qwen-vl-max",
        defaultResolution: "720p",
        defaultDuration: 5,
        defaultAspectRatio: "16:9",
        defaultFps: 24,
        defaultStyle: "cinematic",
        timeout: 300000, // 5 minutes
      },
    });

    await service.save();
    logger.info("✅ AI Video Generator service created successfully");
    return service;
  } catch (error) {
    logger.error("❌ Error creating AI Video Generator service:", error);
    throw error;
  }
};

// Initialize AI Chatbot Builder Service in Database
export const initializeAIChatbotBuilderService = async () => {
  try {
    // Check if service already exists
    const existingService = await Service.findOne({
      type: "ai_chatbot_builder",
    });
    if (existingService) {
      logger.info("✅ AI Chatbot Builder service already exists");
      return existingService;
    }

    // Create new service
    const service = new Service({
      name: "AI Chatbot Builder",
      type: "ai_chatbot_builder",
      description:
        "Create custom AI chatbots trained on your own data with RAG (Retrieval Augmented Generation)",
      category: "AI Content Generation",

      // API Configuration
      apiConfig: {
        provider: "openai",
        apiKey: process.env.OPENAI_API_KEY || "sk-your-openai-api-key",
        baseUrl: "https://api.openai.com/v1",
        endpoints: {
          generate: "chat/completions",
          embeddings: "embeddings",
          status: "models",
        },
      },

      // Service Status
      status: "active",

      // Usage Limits
      limits: {
        dailyRequests: 1000,
        monthlyRequests: 30000,
        maxChatbotsPerUser: 10,
      },

      // Pricing
      pricing: {
        free: {
          chatbotsPerAccount: 0,
          queriesPerDay: 0,
        },
        paid: {
          chatbotsPerAccount: 10,
          queriesPerDay: 1000,
        },
      },

      // Features
      features: [
        "Create custom chatbots with your own data",
        "Train with PDF and text files",
        "RAG (Retrieval Augmented Generation) for context-aware responses",
        "Embeddable widget for external websites",
        "Conversation history tracking",
        "Multiple chatbot templates",
        "Vector database integration (ChromaDB)",
        "Custom system prompts",
        "API key authentication for widgets",
      ],

      // Statistics
      statistics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalChatbots: 0,
        totalQueries: 0,
        averageResponseTime: 0,
      },

      // Configuration
      config: {
        defaultModel: "gpt-3.5-turbo",
        defaultEmbeddingModel: "text-embedding-3-small",
        maxTokens: 500,
        temperature: 0.7,
        timeout: 60000, // 60 seconds
        chunkSize: 1000,
        chunkOverlap: 200,
        topK: 5,
      },
    });

    await service.save();
    logger.info("✅ AI Chatbot Builder service created successfully");
    return service;
  } catch (error) {
    logger.error("❌ Error creating AI Chatbot Builder service:", error);
    throw error;
  }
};

// Initialize AI Search Service in Database
export const initializeAISearchService = async () => {
  try {
    // Check if service already exists
    const existingService = await Service.findOne({ type: "ai_search" });
    if (existingService) {
      logger.info("✅ AI Search service already exists");
      return existingService;
    }

    // Create new service
    const service = new Service({
      name: "AI Search",
      type: "ai_search",
      description:
        "Intelligent semantic search powered by AI and vector database for finding relevant information",
      category: "AI Search & Discovery",

      // API Configuration
      apiConfig: {
        provider: "openai",
        apiKey: process.env.OPENAI_API_KEY || "sk-your-openai-api-key",
        baseUrl: "https://api.openai.com/v1",
        endpoints: {
          embeddings: "embeddings",
          search: "search",
        },
        vectorDatabase: {
          provider: "chromadb",
          url: process.env.CHROMADB_URL || "http://localhost:8000",
        },
      },

      // Service Status
      status: "active",

      // Usage Limits
      limits: {
        dailyRequests: 100,
        monthlyRequests: 3000,
        maxResultsPerQuery: 50,
      },

      // Pricing
      pricing: {
        free: {
          searchesPerDay: 10,
          requestsPerDay: 10,
        },
        paid: {
          searchesPerDay: 500,
          requestsPerDay: 500,
        },
      },

      // Features
      features: [
        "Semantic search using AI embeddings",
        "Vector database integration (ChromaDB)",
        "Natural language queries",
        "Intelligent document indexing",
        "Fast and accurate results",
        "Metadata filtering",
        "Similarity scoring",
      ],

      // Statistics
      statistics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalSearches: 0,
        totalDocumentsIndexed: 0,
        averageResponseTime: 0,
      },

      // Configuration
      config: {
        defaultEmbeddingModel: "text-embedding-3-small",
        defaultLimit: 10,
        maxLimit: 50,
        timeout: 30000, // 30 seconds
        collectionName: "ai_search_documents",
      },
    });

    await service.save();
    logger.info("✅ AI Search service created successfully");
    return service;
  } catch (error) {
    logger.error("❌ Error creating AI Search service:", error);
    throw error;
  }
};
