import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  saveSnippet,
  getUserSnippets,
  getSnippet,
  deleteSnippet,
  saveRunLog,
  getUsageSummary,
  getUserStorageUsed,
  getTodayUsage,
  updateUsage,
} from "../services/editor/editorService.js";
import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";
import { safeLogger as logger } from "../utils/logger.js";
import mongoose from "mongoose";

const UNLIMITED_THRESHOLD = 99999999;

/**
 * Helper: Get user's code editor plan limits
 */
const getEditorPlanLimits = async (userId) => {
  const subscription = await Subscription.findOne({ userId });
  let planLimits = null;

  if (subscription && subscription.isActive() && subscription.planId) {
    const plan = await SubscriptionPlan.findById(subscription.planId);
    if (plan?.features?.codeEditor?.enabled) {
      planLimits = plan.features.codeEditor;
    }
  }

  // Fallback to free plan
  if (!planLimits) {
    const freePlan = await SubscriptionPlan.findOne({
      type: "free",
      status: "active",
    });
    if (freePlan?.features?.codeEditor?.enabled) {
      planLimits = freePlan.features.codeEditor;
    }
  }

  return planLimits;
};

/**
 * Get editor usage summary
 * GET /api/editor/usage
 */
export const getUsage = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const planLimits = await getEditorPlanLimits(userId);
  if (!planLimits) {
    throw new ApiError(403, "Code editor is not available in your plan");
  }

  const usage = await getUsageSummary(userId, planLimits);

  return res
    .status(200)
    .json(new ApiResponse(200, usage, "Usage summary retrieved"));
});

/**
 * Save or create code snippet
 * POST /api/editor/snippets
 * body: { snippetId?, filename, language, code }
 */
export const saveCode = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { snippetId, filename, language, code } = req.body;

  // Validation
  if (!code || typeof code !== "string") {
    throw new ApiError(400, "Code is required");
  }

  if (code.length > 1000000) {
    // 1MB max code size
    throw new ApiError(400, "Code size exceeds maximum limit (1MB)");
  }

  if (filename && filename.length > 255) {
    throw new ApiError(400, "Filename too long (max 255 characters)");
  }

  // Validate snippetId if provided
  if (snippetId && !mongoose.Types.ObjectId.isValid(snippetId)) {
    throw new ApiError(400, "Invalid snippet ID format");
  }

  // Get plan limits
  const planLimits = await getEditorPlanLimits(userId);
  if (!planLimits) {
    throw new ApiError(403, "Code editor is not available in your plan");
  }

  // Check storage quota
  const currentUsed = await getUserStorageUsed(userId);
  const codeSize = Buffer.byteLength(code, "utf8");
  const maxStorageBytes = (planLimits.maxStorageMb || 0) * 1024 * 1024;

  if (!snippetId) {
    // New snippet - check total storage
    if (currentUsed + codeSize > maxStorageBytes) {
      throw new ApiError(
        403,
        `Storage limit exceeded. Used: ${(currentUsed / (1024 * 1024)).toFixed(
          2
        )}MB / Max: ${planLimits.maxStorageMb}MB`
      );
    }

    // Check max files
    const snippets = await getUserSnippets(userId, 1000);
    const maxFiles = planLimits.maxFiles || 0;
    if (maxFiles > 0 && snippets.length >= maxFiles) {
      throw new ApiError(
        403,
        `Maximum files limit reached (${maxFiles} files). Please delete some files or upgrade your plan.`
      );
    }
  } else {
    // Update - check if new size exceeds quota
    const snippet = await getSnippet(snippetId, userId);
    const sizeDiff = codeSize - snippet.sizeBytes;
    if (currentUsed + sizeDiff > maxStorageBytes) {
      throw new ApiError(
        403,
        `Storage limit exceeded. Used: ${(
          (currentUsed + sizeDiff) /
          (1024 * 1024)
        ).toFixed(2)}MB / Max: ${planLimits.maxStorageMb}MB`
      );
    }
  }

  const snippet = await saveSnippet(userId, {
    snippetId,
    filename,
    language,
    code,
  });

  // Get updated usage
  const usage = await getUsageSummary(userId, planLimits);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { snippet, usage },
        snippetId ? "Snippet updated" : "Snippet created"
      )
    );
});

/**
 * Get user's snippets list
 * GET /api/editor/snippets
 */
export const getSnippets = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const limit = parseInt(req.query.limit) || 50;

  const snippets = await getUserSnippets(userId, limit);

  return res
    .status(200)
    .json(new ApiResponse(200, { snippets }, "Snippets retrieved"));
});

/**
 * Get single snippet by ID
 * GET /api/editor/snippets/:id
 */
export const getSnippetById = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid snippet ID format");
  }

  const snippet = await getSnippet(id, userId);

  return res
    .status(200)
    .json(new ApiResponse(200, { snippet }, "Snippet retrieved"));
});

/**
 * Delete snippet
 * DELETE /api/editor/snippets/:id
 */
export const deleteSnippetById = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid snippet ID format");
  }

  await deleteSnippet(id, userId);

  // Get updated usage
  const planLimits = await getEditorPlanLimits(userId);
  const usage = planLimits ? await getUsageSummary(userId, planLimits) : null;

  return res
    .status(200)
    .json(new ApiResponse(200, { usage }, "Snippet deleted successfully"));
});

/**
 * Run code (stub - returns mock output for now)
 * POST /api/editor/run
 * body: { language, code }
 */
export const runCode = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { language, code } = req.body;

  // Validation
  if (!language || !code) {
    throw new ApiError(400, "Language and code are required");
  }

  if (typeof code !== "string" || code.length === 0) {
    throw new ApiError(400, "Code must be a non-empty string");
  }

  if (code.length > 100000) {
    // 100KB max for execution
    throw new ApiError(400, "Code size exceeds execution limit (100KB)");
  }

  // Get plan limits
  const planLimits = await getEditorPlanLimits(userId);
  if (!planLimits) {
    throw new ApiError(403, "Code editor is not available in your plan");
  }

  // Check run limit
  const usage = await getTodayUsage(userId);
  const maxRuns = planLimits.runsPerDay || 0;

  if (maxRuns > 0 && maxRuns < UNLIMITED_THRESHOLD) {
    if (usage.runsToday >= maxRuns) {
      throw new ApiError(
        429,
        `Daily run limit reached (${maxRuns} runs/day). Please upgrade your plan for more runs.`
      );
    }
  }

  // TODO: Implement actual code execution (Docker sandbox, etc.)
  // For now, return mock output
  const startTime = Date.now();
  
  // Special handling for HTML - return HTML code as output
  let mockOutput;
  if (language === "html") {
    // For HTML, return the HTML code itself so it can be rendered
    mockOutput = {
      stdout: code, // Return HTML code as output
      stderr: "",
      exitCode: 0,
    };
  } else {
    // For other languages, return mock message
    mockOutput = {
      stdout: `Code executed successfully (${language})`,
      stderr: "",
      exitCode: 0,
    };
  }
  
  const durationMs = Date.now() - startTime;

  // Save run log
  await saveRunLog(userId, {
    language,
    code,
    ...mockOutput,
    durationMs,
    success: true,
  });

  // Get updated usage
  const updatedUsage = await getUsageSummary(userId, planLimits);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        output: mockOutput,
        durationMs,
        usage: updatedUsage,
      },
      "Code executed"
    )
  );
});

/**
 * AI Explain code
 * POST /api/editor/ai/explain
 * body: { code, language? }
 */
export const explainCode = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { code, language } = req.body;

  // Validation
  if (!code || typeof code !== "string") {
    throw new ApiError(400, "Code is required");
  }

  if (code.length > 50000) {
    // 50KB max for AI explanation
    throw new ApiError(400, "Code size exceeds AI explanation limit (50KB)");
  }

  // Get plan limits
  const planLimits = await getEditorPlanLimits(userId);
  if (!planLimits) {
    throw new ApiError(403, "Code editor is not available in your plan");
  }

  // Check AI calls limit
  const usage = await getTodayUsage(userId);
  const maxAiCalls = planLimits.aiCallsPerDay || 0;

  if (maxAiCalls > 0 && maxAiCalls < UNLIMITED_THRESHOLD) {
    if (usage.aiCallsToday >= maxAiCalls) {
      throw new ApiError(
        429,
        `Daily AI calls limit reached (${maxAiCalls} calls/day). Please upgrade your plan for more AI features.`
      );
    }
  }

  // Implement AI explanation using OpenAI/Ollama
  let explanation = "";
  let errorOccurred = false;

  try {
    // Import OpenAI client and Ollama utilities
    const OpenAI = (await import("openai")).default;
    const ollamaUtils = await import(
      "../services/ai/services/chatbot/utils/ollamaClient.js"
    );
    const { getOllamaChatCompletion, checkOllamaAvailability } = ollamaUtils;

    // Check which provider to use
    const AI_PROVIDER =
      process.env.AI_EXPLAIN_PROVIDER ||
      process.env.TEXT_WRITER_PROVIDER ||
      "ollama";
    const OLLAMA_BASE_URL =
      process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const OLLAMA_MODEL = process.env.OLLAMA_CODE_EXPLAIN_MODEL || "mistral:7b";

    // Create explanation prompt
    const systemPrompt = `You are an expert code reviewer and educator. Your task is to explain code clearly and concisely. 
Focus on:
1. What the code does (main functionality)
2. Key concepts and patterns used
3. Important variables/functions and their purpose
4. Any potential issues or improvements

Keep explanations clear, educational, and easy to understand. Use markdown formatting for better readability.`;

    const userPrompt = `Please explain the following ${language || "code"} code:

\`\`\`${language || "javascript"}
${code}
\`\`\`

Provide a clear, structured explanation.`;

    if (AI_PROVIDER === "ollama") {
      // Use Ollama
      const isOllamaAvailable = await checkOllamaAvailability(OLLAMA_BASE_URL);
      if (isOllamaAvailable) {
        const response = await getOllamaChatCompletion(
          OLLAMA_BASE_URL,
          OLLAMA_MODEL,
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          {
            temperature: 0.7,
            max_tokens: 2000,
          }
        );
        explanation =
          response.message?.content ||
          response.content ||
          "Explanation generated successfully.";
      } else {
        throw new Error("Ollama service is not available");
      }
    } else {
      // Use OpenAI
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      explanation = completion.choices[0].message.content;
    }

    // Update usage only on success
    await updateUsage(userId, { aiCallsToday: 1 });
  } catch (error) {
    logger.error("AI Explanation Error:", error);
    errorOccurred = true;

    // Fallback to helpful mock explanation
    explanation = `**Code Explanation**\n\nThis code is written in **${
      language || "JavaScript"
    }**.\n\n**Code Length:** ${
      code.length
    } characters\n\n**Note:** AI explanation service is temporarily unavailable. Here's what you can do:\n\n1. **Review the code structure** - Check function definitions, variable declarations, and control flow\n2. **Check comments** - Look for inline documentation\n3. **Test the code** - Run it to understand its behavior\n4. **Read documentation** - Refer to language-specific docs for syntax and patterns\n\n**Error:** ${
      error.message
    }`;

    // Still update usage to track attempts
    await updateUsage(userId, { aiCallsToday: 1 });
  }

  // Get updated usage
  const updatedUsage = await getUsageSummary(userId, planLimits);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        explanation: explanation,
        usage: updatedUsage,
        error: errorOccurred
          ? "AI service unavailable, showing fallback explanation"
          : null,
      },
      errorOccurred
        ? "Code explanation generated (fallback)"
        : "Code explanation generated"
    )
  );
});
