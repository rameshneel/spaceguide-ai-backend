/**
 * Model ID Sanitizer
 * Cleans and validates model IDs to prevent corruption
 */

/**
 * Sanitize model ID by removing invalid prefixes, suffixes, and embedded corruption
 * @param {string} modelId - The model ID to sanitize
 * @returns {string} - Cleaned model ID
 */
export const sanitizeModelId = (modelId) => {
  if (!modelId || typeof modelId !== "string") {
    return modelId;
  }

  let cleaned = modelId.trim();

  // Step 0: Preserve org prefix before any cleaning (e.g., "mistralai/", "meta-llama/")
  const orgPrefixMatch = cleaned.match(/^([a-z0-9_-]+\/)/i);
  const orgPrefix = orgPrefixMatch ? orgPrefixMatch[1] : "";
  let modelPart = orgPrefix ? cleaned.replace(/^[a-z0-9_-]+\//i, "") : cleaned;

  // Step 1: Remove common invalid prefixes (only from model part, not org prefix)
  const invalidPrefixes = [
    /^irritable\//i, // Remove "irritable/" prefix (Bug 1)
    /^[a-z]+:\/\//i, // Remove protocol-like prefixes (http://, https://, etc.)
  ];

  for (const pattern of invalidPrefixes) {
    modelPart = modelPart.replace(pattern, "");
  }

  // Reconstruct cleaned string
  cleaned = orgPrefix + modelPart;

  // Step 2: Remove non-ASCII characters and embedded corruption (Bug 2)
  // This handles Korean characters, Chinese, Arabic, etc. that might be inserted
  // First, try to extract valid model ID pattern before removing non-ASCII
  const validModelPatterns = [
    // Meta Llama models (e.g., meta-llama/llama-3.1-70b-instruct)
    /meta-llama\/llama-[\d.]+-[0-9]+[a-z]*-instruct/i,
    /meta-llama\/llama-[\d.]+-[0-9]+[a-z]*/i,
    /meta-llama\/[a-z0-9_.-]+/i,
    // Mistral models (e.g., mistralai/mixtral-8x7b-instruct)
    /mistralai\/mixtral-[0-9x]+[a-z]*-instruct/i,
    /mistralai\/mixtral-[0-9x]+[a-z]*/i,
    /mistralai\/[a-z0-9_.-]+-instruct/i, // Include -instruct suffix
    /mistralai\/[a-z0-9_.-]+/i,
    // OpenAI models
    /^gpt-[\d.]+-turbo/i,
    /^gpt-[\d]+/i,
    /^text-embedding/i,
    /^dall-e/i,
    // Generic HuggingFace format (org/model-name)
    /^[a-z0-9_-]+\/[a-z0-9_.-]+/i,
    // Ollama models
    /^[a-z0-9:]+$/i,
  ];

  // Try to extract valid model ID pattern first
  // But skip this if there's non-ASCII - we need to clean it first
  let extractedModel = null;
  if (!/[^\x00-\x7F]/.test(cleaned)) {
    // Only try to extract if no non-ASCII characters
    for (const pattern of validModelPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        extractedModel = match[0];
        break;
      }
    }
  }

  // Step 3: Remove non-ASCII characters and embedded text corruption
  // Remove Korean, Chinese, Arabic, and other non-ASCII characters
  // But preserve the structure: org/model-name or model-name
  if (extractedModel && !/[^\x00-\x7F]/.test(extractedModel)) {
    // Use extracted model if found and it has no non-ASCII
    cleaned = extractedModel;
  } else {
    // Extract org prefix again (in case it wasn't extracted earlier)
    const currentOrgPrefixMatch = cleaned.match(/^([a-z0-9_-]+\/)/i);
    const currentOrgPrefix = currentOrgPrefixMatch
      ? currentOrgPrefixMatch[1]
      : orgPrefix;
    const currentModelPart = currentOrgPrefix
      ? cleaned.replace(/^[a-z0-9_-]+\//i, "")
      : cleaned;

    // Step 3a: Remove quotes first
    let modelToClean = currentModelPart.replace(/^["']|["']$/g, "");

    // Step 3b: Fix specific corruption patterns before removing non-ASCII
    // Fix "mixtral-8x7 항공-instruct" -> "mixtral-8x7b-instruct" (Bug 2)
    modelToClean = modelToClean.replace(
      /(mixtral-8x7)\s*[가-힣a-zA-Z가-힣]+\s*-instruct/gi,
      "$1b-instruct"
    );
    modelToClean = modelToClean.replace(
      /8x7\s*[가-힣a-zA-Z가-힣]+\s*$/gi,
      "8x7b"
    );

    // Fix "llama-3.1-70b-instruct" if corrupted with non-ASCII
    modelToClean = modelToClean.replace(
      /(llama-[\d.]+-[\d]+)[가-힣a-zA-Z가-힣]*-instruct/gi,
      "$1b-instruct"
    );

    // Step 3c: Remove non-ASCII characters (Korean, Chinese, etc.)
    modelToClean = modelToClean.replace(/[^\x00-\x7F]/g, ""); // Remove non-ASCII

    // Step 3d: Fix patterns after non-ASCII removal - handle "-instruct" suffix specifically
    // Fix "mixtral-8x7 -instruct" -> "mixtral-8x7b-instruct"
    modelToClean = modelToClean.replace(
      /(mixtral-8x7)\s*-instruct/gi,
      "$1b-instruct"
    );
    // Fix "8x7 -instruct" -> "8x7b-instruct" (Bug 2 - after Korean removal)
    modelToClean = modelToClean.replace(/(8x7)\s+-instruct/gi, "$1b-instruct");
    // More general: any number followed by space and -instruct
    modelToClean = modelToClean.replace(
      /([0-9x]+)\s+-instruct/gi,
      "$1b-instruct"
    );

    // Step 3e: Remove embedded words that don't belong
    // Pattern: remove standalone words between model parts
    modelToClean = modelToClean.replace(/\s+[a-zA-Z]+\s+/g, " "); // Remove standalone English words with spaces
    // Fix remaining patterns - but preserve -instruct suffix
    modelToClean = modelToClean.replace(
      /([0-9x]+)\s+([a-z-]+)/gi,
      (match, p1, p2) => {
        // If it's -instruct, add 'b' before it
        if (p2 === "-instruct" || p2.startsWith("-instruct")) {
          return p1 + "b" + p2;
        }
        return p1 + p2;
      }
    );
    modelToClean = modelToClean.replace(/([a-z0-9]+)\s+([a-z-]+)/gi, "$1$2"); // Remove spaces between model parts

    // Reconstruct with org prefix if it existed
    cleaned = currentOrgPrefix + modelToClean;
  }

  // Step 4: Remove quotes if still present
  cleaned = cleaned.replace(/^["']|["']$/g, "");

  // Step 5: Final cleanup - preserve structure but clean invalid characters
  // Keep: letters, numbers, hyphens, underscores, dots, slashes, colons
  // Remove: quotes, special characters, but preserve model structure
  // Note: \w = [A-Za-z0-9_], so we need to explicitly allow hyphens, dots, slashes, colons
  cleaned = cleaned
    .replace(/[^A-Za-z0-9_.\/:-]/g, "") // Keep only: letters, numbers, underscore, dot, slash, hyphen, colon
    .replace(/\s+/g, "") // Remove all whitespace
    .replace(/\/+/g, "/") // Replace multiple slashes with single
    .replace(/--+/g, "-") // Replace multiple hyphens with single
    .replace(/\.\.+/g, ".") // Replace multiple dots with single
    .trim();

  // Step 6: Return cleaned model ID
  // Don't re-extract as it might truncate valid suffixes like "-instruct"
  return cleaned;
};

/**
 * Validate model ID format
 * @param {string} modelId - The model ID to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const isValidModelId = (modelId) => {
  if (!modelId || typeof modelId !== "string") {
    return false;
  }

  // Check for non-ASCII characters (indicates corruption)
  if (/[^\x00-\x7F]/.test(modelId)) {
    return false;
  }

  // Check for common corruption patterns
  if (/irritable\//i.test(modelId)) {
    return false;
  }

  const validPatterns = [
    /^gpt-[\d.]+-turbo/i,
    /^gpt-[\d]+/i,
    /^text-embedding/i,
    /^dall-e/i,
    /^meta-llama\/[a-z0-9_.-]+/i,
    /^llama-[\d.]+/i,
    /^mistralai\/[a-z0-9_.-]+/i,
    /^[a-z0-9_-]+\/[a-z0-9_.-]+/i, // HuggingFace format
    /^[a-z0-9:]+$/i, // Ollama format
  ];

  return validPatterns.some((pattern) => pattern.test(modelId));
};

/**
 * Clean model ID from metadata object
 * @param {object} metadata - Metadata object containing model field
 * @returns {object} - Metadata with cleaned model ID
 */
export const sanitizeModelMetadata = (metadata) => {
  if (!metadata || typeof metadata !== "object") {
    return metadata;
  }

  const cleaned = { ...metadata };

  if (cleaned.model) {
    cleaned.model = sanitizeModelId(cleaned.model);
  }

  if (cleaned.embeddingModel) {
    cleaned.embeddingModel = sanitizeModelId(cleaned.embeddingModel);
  }

  return cleaned;
};
