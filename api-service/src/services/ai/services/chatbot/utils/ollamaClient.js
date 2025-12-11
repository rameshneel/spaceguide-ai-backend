import axios from "axios";
import { safeLogger as logger } from "../../../../../utils/logger.js";

// Ollama API base URL
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

/**
 * Get Ollama embeddings
 * @param {string|string[]} text - Text or array of texts to embed
 * @param {string} model - Embedding model (default: nomic-embed-text)
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
export const getOllamaEmbeddings = async (text, model = "nomic-embed-text") => {
  try {
    const texts = Array.isArray(text) ? text : [text];
    const embeddings = [];

    // Ollama embeddings are generated one at a time
    for (const singleText of texts) {
      const response = await axios.post(
        `${OLLAMA_BASE_URL}/api/embeddings`,
        {
          model: model,
          prompt: singleText,
        },
        {
          timeout: 30000, // 30 seconds timeout
        }
      );

      if (response.data && response.data.embedding) {
        embeddings.push(response.data.embedding);
      } else {
        throw new Error("Invalid response from Ollama embeddings API");
      }
    }

    return Array.isArray(text) ? embeddings : embeddings[0];
  } catch (error) {
    logger.error("Error generating Ollama embeddings:", error);
    if (error.code === "ECONNREFUSED") {
      throw new Error(
        `Cannot connect to Ollama. Make sure Ollama is running on ${OLLAMA_BASE_URL}. Run: ollama serve`
      );
    }
    throw new Error(`Failed to generate Ollama embeddings: ${error.message}`);
  }
};

/**
 * Get chat completion from Ollama
 * @param {Array} messages - Array of message objects with role and content
 * @param {string} model - Model name (default: llama2)
 * @param {number} temperature - Temperature for generation (0-1)
 * @param {number} maxTokens - Maximum tokens to generate
 * @returns {Promise<{content: string, tokens: number}>}
 */
export const getOllamaChatCompletion = async (
  messages,
  model = "llama2",
  temperature = 0.7,
  maxTokens = 500
) => {
  try {
    // Use /api/chat endpoint which properly handles message roles
    // This endpoint supports OpenAI-style message format
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/chat`,
      {
        model: model,
        messages: messages, // Send messages directly without formatting
        stream: false,
        options: {
          temperature: temperature,
          num_predict: maxTokens,
        },
      },
      {
        timeout: 60000, // 60 seconds timeout for generation
      }
    );

    if (
      response.data &&
      response.data.message &&
      response.data.message.content
    ) {
      let content = response.data.message.content;

      // Clean up any unwanted prefixes and formats that might appear in response
      // Remove "User:", "System:", "Assistant:" prefixes
      content = content.replace(/^(User|System|Assistant):\s*/i, "").trim();

      // Remove "Question:" and "Answer:" format patterns
      // Patterns like "Question: ... Answer: ..." or just "Answer: ..."
      content = content
        .replace(/^Question:\s*.+?\n\n?Answer:\s*/is, "") // Remove "Question: ... Answer:" pattern
        .replace(/^Answer:\s*/i, "") // Remove standalone "Answer:" prefix
        .replace(/^Question:\s*/i, "") // Remove standalone "Question:" prefix
        .trim();

      return {
        content: content,
        tokens:
          response.data.eval_count || response.data.prompt_eval_count || 0,
      };
    } else {
      throw new Error("Invalid response from Ollama chat API");
    }
  } catch (error) {
    logger.error("Error generating Ollama chat completion:", error);

    if (error.code === "ECONNREFUSED") {
      throw new Error(
        `Cannot connect to Ollama. Make sure Ollama is running on ${OLLAMA_BASE_URL}. Run: ollama serve`
      );
    }

    // Handle Ollama API errors
    if (error.response && error.response.data && error.response.data.error) {
      const ollamaError = error.response.data.error;

      if (
        ollamaError.includes("system memory") ||
        ollamaError.includes("unable to load") ||
        ollamaError.includes("requires more") ||
        ollamaError.includes("insufficient memory")
      ) {
        // Try to find a smaller available model
        const smallerModels = [
          "tinyllama", // ~637MB - Smallest option
          "gemma3:4b", // ~3.3GB - Small alternative
          "gemma:2b", // ~2GB - Small
          "llama2:7b", // ~4GB - If you have more RAM
        ];

        const alternativeModel = await findSmallestAvailableModel(
          smallerModels
        );

        if (alternativeModel && alternativeModel !== model) {
          throw new Error(
            `Insufficient memory to load model "${model}". ` +
              `Try using a smaller model: "${alternativeModel}". ` +
              `Available models: ${
                (await getAvailableOllamaModels()).join(", ") || "none"
              }. ` +
              `To pull a model: ollama pull ${alternativeModel}`
          );
        }

        // If no alternative found, provide general guidance
        const availableModels = await getAvailableOllamaModels();
        throw new Error(
          `Insufficient memory to load model "${model}". ` +
            `Your system doesn't have enough RAM/VRAM. ` +
            `Available models: ${availableModels.join(", ") || "none"}. ` +
            `Try using a smaller model that's already available, or pull one: ollama pull tinyllama (smallest, ~637MB)`
        );
      }

      if (
        ollamaError.includes("model") &&
        (ollamaError.includes("not found") ||
          ollamaError.includes("does not exist"))
      ) {
        throw new Error(
          `Model "${model}" not found. Pull it first: ollama pull ${model}`
        );
      }

      throw new Error(`Ollama API error: ${ollamaError}`);
    }

    throw new Error(
      `Failed to generate Ollama chat completion: ${error.message}`
    );
  }
};

/**
 * Check if Ollama is available
 * @returns {Promise<boolean>}
 */
export const checkOllamaAvailability = async () => {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 5000,
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

/**
 * Get list of available Ollama models
 * @returns {Promise<string[]>} Array of model names
 */
export const getAvailableOllamaModels = async () => {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 5000,
    });
    if (response.data && response.data.models) {
      return response.data.models.map((model) => model.name);
    }
    return [];
  } catch (error) {
    logger.warn("Error getting available Ollama models:", error);
    return [];
  }
};

/**
 * Find the smallest available model from a list of preferred models
 * @param {string[]} preferredModels - List of models in order of preference
 * @returns {Promise<string|null>} Name of the smallest available model or null
 */
export const findSmallestAvailableModel = async (preferredModels) => {
  try {
    const availableModels = await getAvailableOllamaModels();
    if (availableModels.length === 0) {
      return null;
    }

    // Model size order (smallest to largest)
    const modelSizeOrder = [
      "tinyllama", // ~637MB - Smallest
      "gemma3:4b", // ~3.3GB - Small alternative
      "gemma:2b", // ~2GB - Small
      "gemma:2b-instruct", // ~2GB - Small instruct variant
      "llama2:7b", // ~4GB - Medium
      "llama2", // ~4GB - Medium
      "llama3:8b", // ~5GB - Medium-large
      "llama3", // ~8GB - Large
      "mistral", // ~4GB - Medium
    ];

    // Filter available models that are in preferred list
    const availablePreferred = preferredModels.filter((model) =>
      availableModels.includes(model)
    );

    if (availablePreferred.length > 0) {
      // Return the smallest one based on size order
      for (const model of modelSizeOrder) {
        if (availablePreferred.includes(model)) {
          return model;
        }
      }
      // If not in size order, return first available
      return availablePreferred[0];
    }

    // If no preferred models available, return smallest from all available
    for (const model of modelSizeOrder) {
      if (availableModels.includes(model)) {
        return model;
      }
    }

    // Return first available model as fallback
    return availableModels[0] || null;
  } catch (error) {
    logger.warn("Error finding smallest available model:", error);
    return null;
  }
};
