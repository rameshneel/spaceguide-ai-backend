import CodeSnippet from "../../models/codeSnippet.model.js";
import CodeRun from "../../models/codeRun.model.js";
import EditorUsage from "../../models/editorUsage.model.js";
import { safeLogger as logger } from "../../utils/logger.js";
import { ApiError } from "../../utils/ApiError.js";

/**
 * Calculate storage used by user (in bytes)
 */
export const getUserStorageUsed = async (userId) => {
  try {
    const result = await CodeSnippet.aggregate([
      {
        $match: {
          ownerUserId: userId,
          status: "active",
        },
      },
      {
        $group: {
          _id: null,
          totalBytes: { $sum: "$sizeBytes" },
        },
      },
    ]);

    return result[0]?.totalBytes || 0;
  } catch (error) {
    logger.error("Error calculating user storage:", error);
    return 0;
  }
};

/**
 * Get or create today's usage record
 */
export const getTodayUsage = async (userId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

  let usage = await EditorUsage.findOne({
    ownerUserId: userId,
    date: dateStr,
  });

  if (!usage) {
    // Calculate current storage
    const usedBytes = await getUserStorageUsed(userId);

    usage = new EditorUsage({
      ownerUserId: userId,
      date: dateStr,
      runsToday: 0,
      aiCallsToday: 0,
      storageUsedBytes: usedBytes,
    });
    await usage.save();
  }

  return usage;
};

/**
 * Update usage counters
 */
export const updateUsage = async (userId, updates) => {
  const usage = await getTodayUsage(userId);

  if (updates.runsToday !== undefined) {
    usage.runsToday += updates.runsToday;
  }
  if (updates.aiCallsToday !== undefined) {
    usage.aiCallsToday += updates.aiCallsToday;
  }
  if (updates.usedBytes !== undefined) {
    usage.storageUsedBytes = updates.usedBytes;
  }

  await usage.save();
  return usage;
};

/**
 * Save or update code snippet
 */
export const saveSnippet = async (userId, snippetData) => {
  const { snippetId, filename, language, code } = snippetData;

  // Calculate size
  const sizeBytes = Buffer.byteLength(code, "utf8");

  if (snippetId) {
    // Update existing snippet
    const snippet = await CodeSnippet.findById(snippetId);
    if (!snippet) {
      throw new ApiError(404, "Snippet not found");
    }
    if (snippet.ownerUserId.toString() !== userId.toString()) {
      throw new ApiError(403, "Access denied");
    }

    // Store old version if enabled
    if (snippet.code !== code) {
      snippet.versions.push({
        code: snippet.code,
        sizeBytes: snippet.sizeBytes,
        updatedAt: snippet.updatedAt,
      });
    }

    snippet.filename = filename || snippet.filename;
    snippet.language = language || snippet.language;
    snippet.code = code;
    snippet.sizeBytes = sizeBytes;
    snippet.lastAccessedAt = new Date();
    snippet.updatedAt = new Date();

    await snippet.save();

    // Update usage storage
    const usedBytes = await getUserStorageUsed(userId);
    await updateUsage(userId, { usedBytes });

    return snippet;
  } else {
    // Create new snippet
    const snippet = new CodeSnippet({
      ownerUserId: userId,
      filename: filename || "untitled",
      language: language || "javascript",
      code,
      sizeBytes,
      lastAccessedAt: new Date(),
    });

    await snippet.save();

    // Update usage storage
    const usedBytes = await getUserStorageUsed(userId);
    await updateUsage(userId, { usedBytes });

    return snippet;
  }
};

/**
 * Get user's snippets
 */
export const getUserSnippets = async (userId, limit = 50) => {
  return await CodeSnippet.find({
    ownerUserId: userId,
    status: "active",
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select("-code") // Don't send full code in list
    .lean();
};

/**
 * Get snippet by ID
 */
export const getSnippet = async (snippetId, userId) => {
  const snippet = await CodeSnippet.findById(snippetId);
  if (!snippet) {
    throw new ApiError(404, "Snippet not found");
  }
  if (snippet.ownerUserId.toString() !== userId.toString()) {
    throw new ApiError(403, "Access denied");
  }

  // Update last accessed
  snippet.lastAccessedAt = new Date();
  await snippet.save();

  return snippet;
};

/**
 * Delete snippet (soft delete)
 */
export const deleteSnippet = async (snippetId, userId) => {
  const snippet = await CodeSnippet.findById(snippetId);
  if (!snippet) {
    throw new ApiError(404, "Snippet not found");
  }
  if (snippet.ownerUserId.toString() !== userId.toString()) {
    throw new ApiError(403, "Access denied");
  }

  snippet.status = "deleted";
  snippet.deletedAt = new Date();
  await snippet.save();

  // Update usage storage
  const usedBytes = await getUserStorageUsed(userId);
  await updateUsage(userId, { usedBytes });

  return snippet;
};

/**
 * Save run log
 */
export const saveRunLog = async (userId, runData) => {
  const { language, code, stdout, stderr, exitCode, durationMs, success } =
    runData;

  const codeSizeBytes = Buffer.byteLength(code, "utf8");

  const run = new CodeRun({
    ownerUserId: userId,
    language,
    code: code.substring(0, 10000), // Store first 10KB only
    stdout: stdout?.substring(0, 5000) || "",
    stderr: stderr?.substring(0, 5000) || "",
    exitCode: exitCode || 0,
    durationMs: durationMs || 0,
    success: success !== undefined ? success : exitCode === 0,
    codeSizeBytes,
  });

  await run.save();

  // Update usage counter
  await updateUsage(userId, { runsToday: 1 });

  return run;
};

/**
 * Get usage summary for user
 */
export const getUsageSummary = async (userId, planLimits) => {
  const usage = await getTodayUsage(userId);
  const usedBytes = await getUserStorageUsed(userId);

  const maxStorageBytes = (planLimits?.maxStorageMb || 0) * 1024 * 1024;
  const maxRuns = planLimits?.runsPerDay || 0;
  const maxAiCalls = planLimits?.aiCallsPerDay || 0;

  return {
    storage: {
      usedBytes,
      maxBytes: maxStorageBytes,
      usedMb: (usedBytes / (1024 * 1024)).toFixed(2),
      maxMb: planLimits?.maxStorageMb || 0,
      remainingBytes: Math.max(0, maxStorageBytes - usedBytes),
    },
    runs: {
      today: usage.runsToday,
      max: maxRuns,
      remaining: Math.max(0, maxRuns - usage.runsToday),
    },
    aiCalls: {
      today: usage.aiCallsToday,
      max: maxAiCalls,
      remaining: Math.max(0, maxAiCalls - usage.aiCallsToday),
    },
  };
};
