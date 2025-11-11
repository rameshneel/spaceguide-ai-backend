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
} from "../controllers/service.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import {
  validateTextGeneration,
  validateImageGeneration,
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

export default router;
