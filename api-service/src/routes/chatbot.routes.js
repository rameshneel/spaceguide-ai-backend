import express from "express";
import {
  createChatbotHandler,
  getChatbots,
  getChatbot,
  updateChatbotHandler,
  trainChatbotFile,
  trainChatbotText,
  queryChatbotHandler,
  getConversationHistoryHandler,
  deleteChatbotHandler,
  getWidgetCode,
  updateChatbotWidgetHandler,
  widgetQuery,
  getWidgetInfo,
  getChatbotTemplates,
  getChromaCollections,
  getChromaCollection,
  getChatbotDocuments,
  updateChatbotDocument,
  deleteChatbotDocuments,
} from "../controllers/chatbot.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import {
  validateCreateChatbot,
  validateUpdateChatbot,
  validateUpdateWidget,
  validateTrainWithText,
  validateQueryChatbot,
  validateChatbotId,
  validateWidgetQuery,
} from "../validation/chatbot.validation.js";
import { uploadSingleTrainingFile } from "../middleware/multerPDF.middleware.js";
import {
  chatbotQueryLimiter,
  chatbotTrainingLimiter,
  widgetQueryLimiter,
} from "../middleware/rateLimit.middleware.js";
import { validationResult } from "express-validator";

// Validation result middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

const router = express.Router();

// ========================================
// CHATBOT MANAGEMENT ROUTES (Protected)
// ========================================

// Create chatbot
router.post(
  "/",
  verifyJWT,
  validateCreateChatbot,
  handleValidationErrors,
  createChatbotHandler
);

// Get all user's chatbots
router.get("/", verifyJWT, getChatbots);

// Get available chatbot templates
router.get("/templates", verifyJWT, getChatbotTemplates);

// Get all ChromaDB collections (Debug/Admin)
router.get("/collections", verifyJWT, getChromaCollections);

// Get specific ChromaDB collection details (Debug/Admin)
router.get("/collections/:collectionName", verifyJWT, getChromaCollection);

// Get single chatbot by ID
router.get(
  "/:id",
  verifyJWT,
  validateChatbotId,
  handleValidationErrors,
  getChatbot
);

// Update chatbot configuration
router.put(
  "/:id",
  verifyJWT,
  validateChatbotId,
  validateUpdateChatbot,
  handleValidationErrors,
  updateChatbotHandler
);

// Delete chatbot
router.delete(
  "/:id",
  verifyJWT,
  validateChatbotId,
  handleValidationErrors,
  deleteChatbotHandler
);

// Get widget code
router.get(
  "/:id/widget",
  verifyJWT,
  validateChatbotId,
  handleValidationErrors,
  getWidgetCode
);

// Update widget settings
router.put(
  "/:id/widget",
  verifyJWT,
  validateChatbotId,
  validateUpdateWidget,
  handleValidationErrors,
  updateChatbotWidgetHandler
);

// ========================================
// CHATBOT TRAINING ROUTES (Protected)
// ========================================

// Train chatbot with file (PDF/TXT)
router.post(
  "/:id/train/file",
  verifyJWT,
  chatbotTrainingLimiter,
  validateChatbotId,
  handleValidationErrors,
  uploadSingleTrainingFile,
  trainChatbotFile
);

// Train chatbot with text
router.post(
  "/:id/train/text",
  verifyJWT,
  chatbotTrainingLimiter,
  validateChatbotId,
  validateTrainWithText,
  handleValidationErrors,
  trainChatbotText
);

// ========================================
// CHATBOT COLLECTION MANAGEMENT (User's own chatbots)
// ========================================

// Get chatbot's collection documents
router.get(
  "/:id/documents",
  verifyJWT,
  validateChatbotId,
  handleValidationErrors,
  getChatbotDocuments
);

// Update a document in chatbot collection
router.put(
  "/:id/documents/:documentId",
  verifyJWT,
  validateChatbotId,
  handleValidationErrors,
  updateChatbotDocument
);

// Delete documents from chatbot collection
router.delete(
  "/:id/documents",
  verifyJWT,
  validateChatbotId,
  handleValidationErrors,
  deleteChatbotDocuments
);

// ========================================
// CHATBOT QUERY ROUTES
// ========================================

// Query chatbot (protected - for dashboard)
router.post(
  "/:id/query",
  verifyJWT,
  chatbotQueryLimiter,
  validateChatbotId,
  validateQueryChatbot,
  handleValidationErrors,
  queryChatbotHandler
);

// Get conversation history
router.get(
  "/:id/conversations",
  verifyJWT,
  validateChatbotId,
  handleValidationErrors,
  getConversationHistoryHandler
);

// ========================================
// WIDGET ROUTES (Public - for external websites)
// ========================================

// Widget info endpoint (public, requires API key)
router.get("/widget/:id/info", validateChatbotId, getWidgetInfo);

// Widget query endpoint (public, requires API key)
router.post(
  "/widget/:id/query",
  widgetQueryLimiter,
  validateChatbotId,
  validateWidgetQuery,
  handleValidationErrors,
  widgetQuery
);

export default router;
