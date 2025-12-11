import express from "express";
import {
  getUsage,
  saveCode,
  getSnippets,
  getSnippetById,
  deleteSnippetById,
  runCode,
  explainCode,
} from "../controllers/editor.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Usage summary
router.get("/usage", getUsage);

// Snippets CRUD
router.post("/snippets", saveCode);
router.get("/snippets", getSnippets);
router.get("/snippets/:id", getSnippetById);
router.delete("/snippets/:id", deleteSnippetById);

// Code execution
router.post("/run", runCode);

// AI features
router.post("/ai/explain", explainCode);

export default router;
