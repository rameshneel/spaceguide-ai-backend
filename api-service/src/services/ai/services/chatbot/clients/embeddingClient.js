/**
 * FastAPI Embedding Service Client
 * Client for calling the FastAPI embedding service
 */
import axios from "axios";
import logger from "../../../../../utils/logger.js";

const EMBEDDING_API_URL =
  process.env.EMBEDDING_API_URL || "http://localhost:8001";
const EMBEDDING_TIMEOUT_MS = parseInt(
  process.env.EMBEDDING_TIMEOUT_MS || "30000",
  10
); // 30 seconds default

/**
 * Generate embeddings using FastAPI embedding service
 * @param {string|string[]} text - Text or array of texts to embed
 * @param {string} model - Model name (optional, uses default if not provided)
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
export const generateEmbeddings = async (text, model = null) => {
  try {
    const texts = Array.isArray(text) ? text : [text];

    // Validate input
    if (!texts || texts.length === 0) {
      throw new Error("Text or texts array is required");
    }

    // Single text or batch
    const isSingle = !Array.isArray(text);

    logger.debug(
      `Calling FastAPI embedding service for ${texts.length} text(s)`
    );

    // Call FastAPI service
    const response = await axios.post(
      `${EMBEDDING_API_URL}/api/v1/embeddings/batch`,
      {
        texts: texts,
        model: model || undefined, // Only send if provided
        normalize: false,
      },
      {
        timeout: EMBEDDING_TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data || !response.data.embeddings) {
      throw new Error("Invalid response from embedding service");
    }

    const embeddings = response.data.embeddings;

    // Return single embedding or array based on input
    return isSingle ? embeddings[0] : embeddings;
  } catch (error) {
    logger.error("Error calling FastAPI embedding service:", error);

    // Handle specific errors
    if (error.code === "ECONNREFUSED") {
      throw new Error(
        `Cannot connect to embedding service at ${EMBEDDING_API_URL}. Please ensure the FastAPI embedding service is running.`
      );
    }

    if (error.code === "ETIMEDOUT" || error.message.includes("timeout")) {
      throw new Error(
        `Embedding service request timed out after ${EMBEDDING_TIMEOUT_MS}ms`
      );
    }

    if (error.response) {
      // API returned error
      const status = error.response.status;
      const message =
        error.response.data?.detail ||
        error.response.data?.message ||
        error.message;

      if (status === 400) {
        throw new Error(`Invalid request to embedding service: ${message}`);
      } else if (status === 422) {
        throw new Error(`Validation error: ${message}`);
      } else if (status === 503) {
        // Check if it's a DLL error
        if (message.includes("DLL") || message.includes("PyTorch")) {
          throw new Error(
            `Embedding service unavailable: PyTorch DLL error. ` +
              `Please install Visual C++ Redistributables: https://aka.ms/vs/17/release/vc_redist.x64.exe ` +
              `and restart the FastAPI embedding service.`
          );
        }
        throw new Error(
          `Embedding service unavailable: ${message}. The service may be starting up or the model may not be loaded.`
        );
      } else {
        throw new Error(`Embedding service error (${status}): ${message}`);
      }
    }

    throw new Error(`Failed to generate embeddings: ${error.message}`);
  }
};

/**
 * Generate embedding for a single text
 * @param {string} text - Text to embed
 * @param {string} model - Model name (optional)
 * @returns {Promise<number[]>} Embedding vector
 */
export const generateEmbedding = async (text, model = null) => {
  const embeddings = await generateEmbeddings([text], model);
  return embeddings[0];
};

/**
 * Check if embedding service is available
 * @returns {Promise<boolean>} True if service is available
 */
export const checkServiceHealth = async () => {
  try {
    const response = await axios.get(
      `${EMBEDDING_API_URL}/api/v1/health/ready`,
      {
        timeout: 5000,
      }
    );
    return response.data.status === "ready";
  } catch (error) {
    logger.warn("Embedding service health check failed:", error.message);
    return false;
  }
};
