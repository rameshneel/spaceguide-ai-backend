import express from "express";
import {
  generateText,
  generateTextStream,
  getTextHistory,
  getUsageStats,
  getTextWriterOptions,
  generateImage,
  getImageHistory,
  getImageStats,
  getImageOptions,
  generateVideo,
  getVideoHistory,
  getVideoOptions,
} from "../controllers/service.controller.js";
import {
  search,
  indexDoc,
  indexDocsBatch,
  getStats,
} from "../controllers/search.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { checkSearchAccess } from "../middleware/usageLimit.middleware.js";
import {
  validateTextGeneration,
  validateImageGeneration,
  validateVideoGeneration,
} from "../validation/service.validation.js";

const router = express.Router();

// ========================================
// AI TEXT WRITER SERVICE ROUTES
// ========================================

// Generate AI Text
router.post("/text/generate", verifyJWT, validateTextGeneration, generateText);

router.post("/text/generate-stream", verifyJWT, generateTextStream);

// Get Text Generation History
router.get("/text/history", verifyJWT, getTextHistory);

// Get Service Options (Content Types, Tones, Lengths)
router.get("/text/options", verifyJWT, getTextWriterOptions);

// Get Usage Statistics
router.get("/text/usage", verifyJWT, getUsageStats);

// ========================================
// AI IMAGE GENERATOR SERVICE ROUTES
// ========================================

// Generate AI Image
router.post(
  "/image/generate",
  verifyJWT,
  validateImageGeneration,
  generateImage
);

// Get Image Generation History
router.get("/image/history", verifyJWT, getImageHistory);

// Get Image Generation Options (Sizes, Qualities, Styles)
router.get("/image/options", verifyJWT, getImageOptions);

// Get Image Usage Statistics
router.get("/image/usage", verifyJWT, getImageStats);

// ========================================
// AI VIDEO GENERATOR SERVICE ROUTES
// ========================================

// Generate AI Video
router.post(
  "/video/generate",
  verifyJWT,
  validateVideoGeneration,
  generateVideo
);

// Get Video Generation History
router.get("/video/history", verifyJWT, getVideoHistory);

// Get Video Generation Options (Resolutions, Durations, Styles, Aspect Ratios)
router.get("/video/options", verifyJWT, getVideoOptions);

// ========================================
// AI SEARCH SERVICE ROUTES
// ========================================

// Perform AI Search (with usage limit check)
router.post("/search", verifyJWT, checkSearchAccess, search);

// Index a document (Admin/Internal)
router.post("/search/index", verifyJWT, indexDoc);

// Index multiple documents (Admin/Internal)
router.post("/search/index-batch", verifyJWT, indexDocsBatch);

// Get search collection statistics
router.get("/search/stats", verifyJWT, getStats);

export default router;
