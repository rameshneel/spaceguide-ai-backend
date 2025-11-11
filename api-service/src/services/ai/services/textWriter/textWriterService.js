import OpenAI from "openai";
import {
  getOllamaChatCompletion,
  checkOllamaAvailability,
  getAvailableOllamaModels,
  findSmallestAvailableModel,
} from "../chatbot/utils/ollamaClient.js";
import logger from "../../../../utils/logger.js";
import axios from "axios";

// Provider selection: 'openai' or 'ollama'
const TEXT_WRITER_PROVIDER = process.env.TEXT_WRITER_PROVIDER || "ollama"; // Default to ollama

// Ollama configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_TEXT_WRITER_MODEL || "mistral:7b"; // Use mistral-7b for text writer

// Lazy-loaded clients
let openai = null;

// Initialize OpenAI client when needed
const getOpenAIClient = () => {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
};

// Get API client (OpenAI or Ollama)
const getAIClient = () => {
  if (TEXT_WRITER_PROVIDER === "ollama") {
    // Ollama doesn't need a client object, return null and handle separately
    return null;
  }
  return getOpenAIClient();
};

// Get model name based on provider
const getModel = () => {
  if (TEXT_WRITER_PROVIDER === "ollama") {
    return OLLAMA_MODEL;
  }
  return "gpt-3.5-turbo";
};

// Validate environment based on provider
function validateEnvironment() {
  if (TEXT_WRITER_PROVIDER === "ollama") {
    // Ollama doesn't require API keys, just needs to be running
    return;
  }

  if (TEXT_WRITER_PROVIDER === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY environment variable is required when using OpenAI provider"
      );
    }
    return;
  }

  // Default: Ollama (no API key needed)
  return;
}

// Get Ollama streaming response with error handling
async function* getOllamaStream(messages, model, temperature, maxTokens) {
  try {
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/chat`,
      {
        model: model,
        messages: messages,
        stream: true,
        options: {
          temperature: temperature,
          num_predict: maxTokens,
        },
      },
      {
        timeout: 120000, // 2 minutes timeout for generation
        responseType: "stream",
        validateStatus: () => true, // Don't throw on any status, we'll handle it manually
      }
    );

    // Check for error status
    if (response.status >= 400) {
      // Read error response
      let errorData = "";
      for await (const chunk of response.data) {
        errorData += chunk.toString();
      }

      try {
        const errorJson = JSON.parse(errorData);
        const errorMessage = errorJson.error || errorData;

        // Handle memory errors
        if (
          errorMessage.includes("system memory") ||
          errorMessage.includes("unable to load") ||
          errorMessage.includes("requires more") ||
          errorMessage.includes("insufficient memory")
        ) {
          throw new Error(
            `MEMORY_ERROR: Model "${model}" requires more memory. ` +
              `Try using a smaller model or increase available RAM/VRAM.`
          );
        }

        throw new Error(`Ollama API error: ${errorMessage}`);
      } catch (parseError) {
        throw new Error(
          `Ollama API error (${response.status}): ${
            errorData || response.statusText
          }`
        );
      }
    }

    // Process streaming response
    for await (const chunk of response.data) {
      const lines = chunk
        .toString()
        .split("\n")
        .filter((line) => line.trim());
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.error) {
            throw new Error(`Ollama streaming error: ${data.error}`);
          }
          if (data.message && data.message.content) {
            yield data.message.content;
          }
          if (data.done) {
            break;
          }
        } catch (e) {
          // If it's an error object, throw it
          if (e.message && e.message.includes("Ollama streaming error")) {
            throw e;
          }
          // Skip invalid JSON lines
          continue;
        }
      }
    }
  } catch (error) {
    logger.error("Ollama streaming error:", error);
    if (error.code === "ECONNREFUSED") {
      throw new Error(
        `Cannot connect to Ollama. Make sure Ollama is running on ${OLLAMA_BASE_URL}. Run: ollama serve`
      );
    }
    // Re-throw if it's already a formatted error
    if (error.message && error.message.includes("MEMORY_ERROR")) {
      throw error;
    }
    throw error;
  }
}

// AI Text Writer Service
export class AITextWriterService {
  constructor() {
    this.model = "gpt-3.5-turbo";
    this.maxTokens = 1000;
    this.temperature = 0.7;
    this.timeout = 30000; // 30 seconds timeout
  }

  // Generate text with streaming support
  async *generateTextStream(prompt, contentType, options = {}) {
    // Skip validation for streaming - allow mock fallback
    // validateEnvironment();

    const {
      tone = "professional",
      length = "medium",
      language = "English",
    } = options;

    const systemPrompt = this.getSystemPrompt(
      prompt,
      contentType,
      tone,
      length,
      language
    );

    try {
      // Check provider and get appropriate client
      if (TEXT_WRITER_PROVIDER === "ollama") {
        // Check if Ollama is available
        const isOllamaAvailable = await checkOllamaAvailability();
        if (!isOllamaAvailable) {
          logger.warn("🔄 Ollama not available, using mock streaming");
          throw new Error("Ollama not available");
        }

        logger.info(`🚀 Using Ollama with model: ${OLLAMA_MODEL}`);

        const messages = [
          {
            role: "system",
            content:
              "You are a professional content writer. Write high-quality, engaging content that meets the user's requirements.",
          },
          {
            role: "user",
            content: systemPrompt,
          },
        ];

        let fullText = "";
        let currentModel = OLLAMA_MODEL;
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
          try {
            const stream = getOllamaStream(
              messages,
              currentModel,
              this.temperature,
              this.maxTokens
            );

            for await (const chunk of stream) {
              if (chunk) {
                fullText += chunk;
                yield chunk;
              }
            }
            // Success - break out of retry loop
            break;
          } catch (streamError) {
            // Handle memory errors with fallback to smaller model
            if (
              streamError.message &&
              streamError.message.includes("MEMORY_ERROR") &&
              retryCount < maxRetries
            ) {
              logger.warn(
                `⚠️ Memory error with model "${currentModel}", trying smaller model...`
              );

              // Try to find a smaller available model
              const smallerModels = [
                "tinyllama", // ~637MB - Smallest
                "gemma:2b", // ~2GB
                "gemma3:4b", // ~3.3GB
                "llama2:7b", // ~4GB
                "mistral", // ~4GB (without :7b)
              ];

              const alternativeModel = await findSmallestAvailableModel(
                smallerModels.filter((m) => m !== currentModel)
              );

              if (alternativeModel && alternativeModel !== currentModel) {
                logger.info(
                  `🔄 Switching to smaller model: ${alternativeModel}`
                );
                currentModel = alternativeModel;
                retryCount++;
                continue; // Retry with smaller model
              } else {
                // No alternative found, throw helpful error
                const availableModels = await getAvailableOllamaModels();
                throw new Error(
                  `Insufficient memory to load model "${OLLAMA_MODEL}". ` +
                    `Available models: ${
                      availableModels.join(", ") || "none"
                    }. ` +
                    `Try pulling a smaller model: ollama pull tinyllama (smallest, ~637MB)`
                );
              }
            }
            // Re-throw other errors
            throw streamError;
          }
        }

        // Calculate word count
        const trimmedText = fullText.trim();
        const wordsGenerated = trimmedText
          .split(/\s+/)
          .filter((w) => w.length > 0).length;

        return {
          success: true,
          content: trimmedText,
          wordsGenerated: wordsGenerated,
          model: OLLAMA_MODEL,
        };
      }

      // Try OpenAI
      let openaiClient;
      try {
        openaiClient = getAIClient();
        logger.info(`🚀 Using OpenAI`);
      } catch (e) {
        logger.warn("🔄 AI service not available, using mock streaming");
        // Yield mock content with streaming effect
        const mockContent = this.generateMockText(prompt, contentType, options);
        const words = mockContent.content.split(" ");
        let mockFullText = "";

        for (const word of words) {
          const wordWithSpace = word + " ";
          mockFullText += wordWithSpace;
          yield wordWithSpace; // ← Yield only strings
          // Small delay for realistic streaming
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        // Calculate word count properly
        const trimmedMockText = mockFullText.trim();
        const mockWordsGenerated = trimmedMockText
          .split(/\s+/)
          .filter((w) => w.length > 0).length;

        // ← Return final result object (not yield)
        return {
          success: true,
          content: trimmedMockText,
          wordsGenerated: mockWordsGenerated,
          model: "mock-streaming",
        };
      }

      const stream = await openaiClient.chat.completions.create({
        model: getModel(),
        messages: [
          {
            role: "system",
            content:
              "You are a professional content writer. Write high-quality, engaging content that meets the user's requirements.",
          },
          {
            role: "user",
            content: systemPrompt,
          },
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        stream: true,
      });

      let fullText = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullText += content;
          yield content; // ← Yield only string chunks (best practice)
        }
      }

      // Calculate word count properly (trim and filter empty strings)
      const trimmedText = fullText.trim();
      const wordsGenerated = trimmedText
        .split(/\s+/)
        .filter((w) => w.length > 0).length;

      // ← Return final result object (not yield - best practice)
      return {
        success: true,
        content: trimmedText,
        wordsGenerated: wordsGenerated,
        model: getModel(),
      };
    } catch (error) {
      logger.error("Text Writer Streaming Error:", error);

      // If quota exceeded or rate limit, fall back to mock
      if (
        error.code === "insufficient_quota" ||
        error.status === 429 ||
        error.code === "rate_limit_exceeded"
      ) {
        logger.warn(
          "🔄 OpenAI quota/rate limit exceeded, falling back to mock streaming"
        );

        // Generate mock content with streaming effect
        const mockContent = this.generateMockText(prompt, contentType, options);
        const words = mockContent.content.split(" ");
        let mockFullText = "";

        for (const word of words) {
          const wordWithSpace = word + " ";
          mockFullText += wordWithSpace;
          yield wordWithSpace; // ← Yield only strings
          // Small delay for realistic streaming
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        // Calculate word count properly
        const trimmedMockText = mockFullText.trim();
        const mockWordsGenerated = trimmedMockText
          .split(/\s+/)
          .filter((w) => w.length > 0).length;

        // ← Return final result object (not yield)
        return {
          success: true,
          content: trimmedMockText,
          wordsGenerated: mockWordsGenerated,
          model: "mock-streaming",
        };
      }

      // For other errors, yield error message as string, then return error object
      // This allows frontend to display error during streaming
      yield `\n\nError: ${error.message}`;

      // ← Return error object (not yield - best practice)
      return {
        success: false,
        error: error.message,
        content: `Error: ${error.message}`,
      };
    }
  }

  // Generate text based on content type
  async generateText(prompt, contentType, options = {}) {
    // Validate environment at runtime
    validateEnvironment();

    const {
      tone = "professional",
      length = "medium",
      language = "English",
    } = options;

    // Prepare system prompt based on content type
    const systemPrompt = this.getSystemPrompt(
      prompt,
      contentType,
      tone,
      length,
      language
    );

    try {
      const startTime = Date.now();

      // Use Ollama if provider is set to ollama
      if (TEXT_WRITER_PROVIDER === "ollama") {
        const isOllamaAvailable = await checkOllamaAvailability();
        if (!isOllamaAvailable) {
          throw new Error(
            `Cannot connect to Ollama. Make sure Ollama is running on ${OLLAMA_BASE_URL}. Run: ollama serve`
          );
        }

        logger.info(`🚀 Using Ollama with model: ${OLLAMA_MODEL}`);

        const messages = [
          {
            role: "system",
            content:
              "You are a professional content writer. Write high-quality, engaging content that meets the user's requirements.",
          },
          {
            role: "user",
            content: systemPrompt,
          },
        ];

        let currentModel = OLLAMA_MODEL;
        let retryCount = 0;
        const maxRetries = 2;
        let result;

        while (retryCount <= maxRetries) {
          try {
            result = await getOllamaChatCompletion(
              messages,
              currentModel,
              this.temperature,
              this.maxTokens
            );
            // Success - break out of retry loop
            break;
          } catch (error) {
            // Handle memory errors with fallback to smaller model
            if (
              error.message &&
              (error.message.includes("system memory") ||
                error.message.includes("unable to load") ||
                error.message.includes("requires more") ||
                error.message.includes("insufficient memory")) &&
              retryCount < maxRetries
            ) {
              logger.warn(
                `⚠️ Memory error with model "${currentModel}", trying smaller model...`
              );

              // Try to find a smaller available model
              const smallerModels = [
                "tinyllama", // ~637MB - Smallest
                "gemma:2b", // ~2GB
                "gemma3:4b", // ~3.3GB
                "llama2:7b", // ~4GB
                "mistral", // ~4GB (without :7b)
              ];

              const alternativeModel = await findSmallestAvailableModel(
                smallerModels.filter((m) => m !== currentModel)
              );

              if (alternativeModel && alternativeModel !== currentModel) {
                logger.info(
                  `🔄 Switching to smaller model: ${alternativeModel}`
                );
                currentModel = alternativeModel;
                retryCount++;
                continue; // Retry with smaller model
              } else {
                // No alternative found, throw helpful error
                const availableModels = await getAvailableOllamaModels();
                throw new Error(
                  `Insufficient memory to load model "${OLLAMA_MODEL}". ` +
                    `Available models: ${
                      availableModels.join(", ") || "none"
                    }. ` +
                    `Try pulling a smaller model: ollama pull tinyllama (smallest, ~637MB)`
                );
              }
            }
            // Re-throw other errors
            throw error;
          }
        }

        const duration = Date.now() - startTime;
        const generatedText = result.content;
        const wordsGenerated = generatedText
          .split(/\s+/)
          .filter((w) => w.length > 0).length;

        return {
          success: true,
          content: generatedText,
          wordsGenerated: wordsGenerated,
          tokensUsed: result.tokens || 0,
          model: currentModel, // Return the model that actually worked
          duration: duration,
        };
      }

      // Use OpenAI
      const openaiClient = getAIClient();
      if (!openaiClient) {
        throw new Error("AI client not available");
      }

      const completion = await openaiClient.chat.completions.create({
        model: getModel(),
        messages: [
          {
            role: "system",
            content:
              "You are a professional content writer. Write high-quality, engaging content that meets the user's requirements.",
          },
          {
            role: "user",
            content: systemPrompt,
          },
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        stream: false,
      });

      const duration = Date.now() - startTime;
      const generatedText = completion.choices[0].message.content;
      const wordsGenerated = generatedText
        .split(/\s+/)
        .filter((w) => w.length > 0).length;

      return {
        success: true,
        content: generatedText,
        wordsGenerated: wordsGenerated,
        tokensUsed: completion.usage?.total_tokens || 0,
        model: getModel(),
        duration: duration,
      };
    } catch (error) {
      logger.error("Text Writer API Error:", error);

      // If quota exceeded, fall back to mock service
      if (error.code === "insufficient_quota" || error.status === 429) {
        logger.warn("🔄 OpenAI quota exceeded, falling back to mock service");
        return this.generateMockText(prompt, contentType, options);
      }

      return {
        success: false,
        error: error.message,
        code: error.code || "API_ERROR",
      };
    }
  }

  // Mock AI service for testing (when OpenAI quota exceeded)
  generateMockText(prompt, contentType, options = {}) {
    const { tone = "professional", length = "medium" } = options;

    const mockContent = {
      blog_post: `# ${prompt}\n\nThis is a comprehensive blog post about "${prompt}". In today's rapidly evolving digital landscape, understanding this topic is crucial for success. This article explores the key aspects, benefits, and practical applications.\n\n## Key Points\n\n1. **Introduction**: ${prompt} represents a significant opportunity for growth and innovation.\n2. **Main Content**: The core concepts involve strategic thinking and implementation.\n3. **Conclusion**: By following these principles, you can achieve remarkable results.\n\n*This content was generated using our AI Text Writer service.*`,

      social_media: `🚀 ${prompt}\n\nExcited to share insights about this amazing topic! 💡\n\nKey takeaways:\n✅ Important point 1\n✅ Important point 2\n✅ Important point 3\n\n#AI #Innovation #Business`,

      email: `Subject: ${prompt}\n\nDear [Recipient],\n\nI hope this email finds you well. I wanted to reach out regarding ${prompt}.\n\nThis is an important topic that I believe would be valuable for you to consider. The key benefits include:\n\n• Benefit 1\n• Benefit 2\n• Benefit 3\n\nI would love to discuss this further with you. Please let me know if you're interested in learning more.\n\nBest regards,\n[Your Name]`,

      product_description: `**${prompt}**\n\nTransform your business with our innovative solution! This powerful tool delivers exceptional results through cutting-edge technology.\n\n**Key Features:**\n• Advanced functionality\n• User-friendly interface\n• Reliable performance\n• 24/7 support\n\n**Benefits:**\n• Increased efficiency\n• Cost savings\n• Better results\n\nPerfect for businesses looking to streamline operations and boost productivity.`,

      ad_copy: `🎯 ${prompt}\n\nDon't miss out! Limited time offer.\n\n✨ Special features\n✨ Amazing benefits\n✨ Proven results\n\nAct now and transform your business today!`,

      general: `**${prompt}**\n\nThis is a well-crafted piece of content about "${prompt}". The content covers the essential aspects and provides valuable insights.\n\nKey highlights include:\n- Important aspect 1\n- Important aspect 2\n- Important aspect 3\n\nThis content demonstrates the power of AI-driven text generation.`,
    };

    const content = mockContent[contentType] || mockContent.general;
    const wordsGenerated = content.split(" ").length;
    const duration = Math.random() * 1000 + 500; // 500-1500ms

    return {
      success: true,
      content: content,
      wordsGenerated: wordsGenerated,
      tokensUsed: Math.floor(wordsGenerated * 1.3), // Approximate token count
      model: "mock-ai-service",
      duration: Math.floor(duration),
    };
  }

  // Get system prompt based on content type
  getSystemPrompt(prompt, contentType, tone, length, language) {
    const prompts = {
      blog_post: `Write a comprehensive blog post about: ${prompt}. Tone: ${tone}. Length: ${length}. Language: ${language}. Include an engaging introduction, well-structured body paragraphs, and a compelling conclusion.`,

      social_media: `Write engaging social media content about: ${prompt}. Tone: ${tone}. Length: ${length}. Language: ${language}. Make it shareable and include relevant hashtags.`,

      email: `Write a professional email about: ${prompt}. Tone: ${tone}. Length: ${length}. Language: ${language}. Include proper greeting, clear subject line suggestion, and professional closing.`,

      product_description: `Write a compelling product description for: ${prompt}. Tone: ${tone}. Length: ${length}. Language: ${language}. Highlight key features, benefits, and include a call-to-action.`,

      ad_copy: `Write persuasive ad copy for: ${prompt}. Tone: ${tone}. Length: ${length}. Language: ${language}. Focus on benefits, create urgency, and include a strong call-to-action.`,

      general: `Write content about: ${prompt}. Tone: ${tone}. Length: ${length}. Language: ${language}. Make it informative and engaging.`,
    };

    return prompts[contentType] || prompts.general;
  }

  // Get available content types
  getContentTypes() {
    return [
      {
        value: "blog_post",
        label: "Blog Post",
        description: "Comprehensive articles and blog posts",
      },
      {
        value: "social_media",
        label: "Social Media",
        description: "Posts for social media platforms",
      },
      {
        value: "email",
        label: "Email",
        description: "Professional email content",
      },
      {
        value: "product_description",
        label: "Product Description",
        description: "Marketing product descriptions",
      },
      {
        value: "ad_copy",
        label: "Ad Copy",
        description: "Persuasive advertising content",
      },
      {
        value: "general",
        label: "General",
        description: "General purpose content",
      },
    ];
  }

  // Get available tones
  getTones() {
    return [
      {
        value: "professional",
        label: "Professional",
        description: "Formal and business-like",
      },
      {
        value: "casual",
        label: "Casual",
        description: "Relaxed and conversational",
      },
      {
        value: "creative",
        label: "Creative",
        description: "Imaginative and artistic",
      },
      {
        value: "persuasive",
        label: "Persuasive",
        description: "Convincing and compelling",
      },
      {
        value: "friendly",
        label: "Friendly",
        description: "Warm and approachable",
      },
      {
        value: "formal",
        label: "Formal",
        description: "Structured and official",
      },
    ];
  }

  // Get available lengths
  getLengths() {
    return [
      {
        value: "short",
        label: "Short",
        description: "Brief and concise (50-150 words)",
      },
      {
        value: "medium",
        label: "Medium",
        description: "Balanced length (150-400 words)",
      },
      {
        value: "long",
        label: "Long",
        description: "Detailed and comprehensive (400+ words)",
      },
    ];
  }

  // Validate input parameters
  validateInput(prompt, contentType) {
    const errors = [];

    if (!prompt || prompt.trim().length < 10) {
      errors.push("Prompt must be at least 10 characters long");
    }

    if (prompt && prompt.length > 1000) {
      errors.push("Prompt must be less than 1000 characters");
    }

    const validContentTypes = [
      "blog_post",
      "social_media",
      "email",
      "product_description",
      "ad_copy",
      "general",
    ];
    if (!contentType || !validContentTypes.includes(contentType)) {
      errors.push("Invalid content type");
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }
}

// Export singleton instance
export const aiTextWriterService = new AITextWriterService();
