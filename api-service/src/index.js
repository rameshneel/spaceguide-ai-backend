// Load and validate environment variables FIRST
import "./config/env.js";

// Setup PDF polyfills early (before any module imports pdf-parse)
import "./utils/pdfPolyfill.js";

import { createServer } from "http";
import app from "./app.js";
import connectDB from "./config/database.js";
import { safeLogger as logger } from "./utils/logger.js";
import { initializeSocketIO } from "./services/communication/socketIOService.js";
import {
  initializeAITextWriterService,
  initializeAIImageGeneratorService,
  initializeAIVideoGeneratorService,
  initializeAIChatbotBuilderService,
  initializeAISearchService,
} from "./services/ai/utils/serviceInitializer.js";
import { initializeSubscriptionPlans } from "./services/subscription/planInitializer.js";
import { initializeChatbotTemplates } from "./services/ai/services/chatbot/utils/templateInitializer.js";

const PORT = process.env.PORT || 5000;

// Log AI Provider configuration
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || "openai";
const CHAT_PROVIDER =
  process.env.CHAT_PROVIDER || process.env.EMBEDDING_PROVIDER || "openai";

logger.info("🤖 AI Provider Configuration:");
logger.info(`   Embeddings: ${EMBEDDING_PROVIDER.toUpperCase()}`);
logger.info(`   Chat: ${CHAT_PROVIDER.toUpperCase()}`);

if (EMBEDDING_PROVIDER === "ollama" || CHAT_PROVIDER === "ollama") {
  const OLLAMA_BASE_URL =
    process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  logger.info(`   Ollama URL: ${OLLAMA_BASE_URL}`);
  logger.warn("   ⚠️  Make sure Ollama is running: ollama serve");
}

if (EMBEDDING_PROVIDER === "fastapi") {
  const EMBEDDING_API_URL =
    process.env.EMBEDDING_API_URL || "http://localhost:8001";
  logger.info(`   FastAPI Embedding Service URL: ${EMBEDDING_API_URL}`);
  logger.warn("   ⚠️  Make sure FastAPI embedding service is running");
}

// Create HTTP server
const server = createServer(app);

// Initialize Socket.IO
const socketService = initializeSocketIO(server);

// Connect to database and initialize services
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Initialize AI services
    await initializeAITextWriterService();
    await initializeAIImageGeneratorService();
    await initializeAIVideoGeneratorService();
    await initializeAIChatbotBuilderService();
    await initializeAISearchService();

    // Initialize subscription plans
    await initializeSubscriptionPlans();

    // Initialize chatbot templates
    await initializeChatbotTemplates();

    // Get base URL for logging
    const getBaseUrl = () => {
      if (process.env.BASE_URL) return process.env.BASE_URL;
      if (process.env.API_URL) return process.env.API_URL;
      const protocol = "https";
      const host = process.env.HOST || "localhost";
      return `${protocol}://${host}:${PORT}`;
    };

    const baseUrl = getBaseUrl();
    const wsProtocol = "wss";
    const wsUrl = baseUrl.replace(/^https?/, wsProtocol);

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`🌍 Environment: single-mode`);
      logger.info(`🏥 Health check: ${baseUrl}/health`);
      logger.info(`📝 AI Text Writer: ${baseUrl}/api/services/text/generate`);
      logger.info(
        `🎨 AI Image Generator: ${baseUrl}/api/services/image/generate`
      );
      logger.info(`🤖 AI Chatbot Builder: ${baseUrl}/api/chatbot`);
      logger.info(`🔌 Socket.IO: ${wsUrl}`);
      logger.info(
        `👥 Connected users: ${socketService.getConnectedUsersCount()}`
      );
    });
  } catch (error) {
    logger.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
