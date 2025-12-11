import OpenAI from "openai";
import { safeLogger as logger } from "../../../../../utils/logger.js";
import { getOllamaEmbeddings } from "./ollamaClient.js";
import { generateEmbeddings as generateEmbeddingsFastAPI } from "../clients/embeddingClient.js";

// Get provider dynamically (not at module load time)
const getEmbeddingProvider = () => {
  return process.env.EMBEDDING_PROVIDER || "openai";
};

// Lazy-loaded OpenAI client
let openai = null;

const getOpenAIClient = () => {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
};

/**
 * Generate embeddings for text using OpenAI or Ollama
 * @param {string|string[]} text - Text or array of texts to embed
 * @param {string} model - Embedding model
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
export const generateEmbeddings = async (
  text,
  model = "text-embedding-3-small"
) => {
  // Get provider dynamically (check at runtime, not module load time)
  const EMBEDDING_PROVIDER = getEmbeddingProvider();

  // Use FastAPI embedding service if provider is set to fastapi
  if (EMBEDDING_PROVIDER === "fastapi") {
    logger.debug("Using FastAPI embedding service");
    // FastAPI service will handle model name mapping internally
    // We can pass OpenAI model names directly, and FastAPI will map them
    // Or pass null/undefined to use default model
    const fastapiModel = model || undefined; // Let FastAPI handle mapping
    return await generateEmbeddingsFastAPI(text, fastapiModel);
  }

  // Use Ollama if provider is set to ollama
  if (EMBEDDING_PROVIDER === "ollama") {
    // Map OpenAI model names to Ollama model names
    const ollamaModelMap = {
      "text-embedding-3-small": "nomic-embed-text",
      "text-embedding-ada-002": "nomic-embed-text",
    };
    const ollamaModel = ollamaModelMap[model] || model || "nomic-embed-text";
    return await getOllamaEmbeddings(text, ollamaModel);
  }

  // Default to OpenAI
  try {
    const client = getOpenAIClient();

    // Handle both single text and array of texts
    const texts = Array.isArray(text) ? text : [text];

    const timeoutMs = 20000; // 20 seconds timeout for embeddings

    // OpenAI allows batch embedding generation
    const embeddingsPromise = client.embeddings.create({
      model: model,
      input: texts,
      timeout: timeoutMs,
    });

    // Add timeout handling with cleanup
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Embeddings API request timed out after 20 seconds"));
      }, timeoutMs);
    });

    try {
      const response = await Promise.race([embeddingsPromise, timeoutPromise]);
      clearTimeout(timeoutId); // Clear timeout if promise resolves
      const embeddings = response.data.map((item) => item.embedding);

      return Array.isArray(text) ? embeddings : embeddings[0];
    } catch (error) {
      clearTimeout(timeoutId); // Clear timeout on error
      throw error;
    }
  } catch (error) {
    logger.error("Error generating embeddings:", error);

    // Handle specific OpenAI API errors
    if (error.status === 429) {
      if (error.code === "insufficient_quota") {
        throw new Error(
          "OpenAI API quota exceeded. Please check your OpenAI account billing and plan details. You may need to add credits or upgrade your plan."
        );
      } else {
        throw new Error(
          "OpenAI API rate limit exceeded. Please try again in a few moments."
        );
      }
    } else if (error.status === 401) {
      throw new Error(
        "OpenAI API key is invalid or expired. Please check your API key configuration."
      );
    } else if (error.status === 500 || error.status === 503) {
      throw new Error(
        "OpenAI API service is temporarily unavailable. Please try again later."
      );
    }

    throw new Error(`Failed to generate embeddings: ${error.message}`);
  }
};

/**
 * Generate embedding for a single text
 * @param {string} text - Text to embed
 * @param {string} model - Embedding model
 * @returns {Promise<number[]>} Embedding vector
 */
export const generateEmbedding = async (
  text,
  model = "text-embedding-3-small"
) => {
  const embeddings = await generateEmbeddings([text], model);
  return embeddings[0];
};
