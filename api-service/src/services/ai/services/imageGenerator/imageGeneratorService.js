import OpenAI from "openai";
import { downloadAndSaveImage } from "../../../../utils/imageStorage.js";
import {
  generateHuggingFaceImage,
  getHuggingFaceModels,
} from "../../providers/huggingface.js";
import {
  generatePollinationsImage,
  getPollinationsModels,
} from "../../providers/pollinations.js";
import {
  IMAGE_GENERATION_CONSTANTS,
  PROVIDER_MODELS,
  STYLE_ENHANCEMENTS,
  SUPPORTED_STYLES,
  SUPPORTED_QUALITIES,
  POLLINATIONS_MODELS,
} from "./constants.js";
import {
  saveBase64Image,
  buildImageResponse,
} from "./utils/imageStorageUtils.js";

// Provider selection: Free providers for development, DALL·E 3 for production
// Options: pollinations (no API key), huggingface, openai
// Priority: pollinations > huggingface > openai
const getDefaultProvider = () => {
  if (process.env.IMAGE_PROVIDER) {
    return process.env.IMAGE_PROVIDER;
  }

  // Try free providers in order (Pollinations doesn't need API key!)
  if (process.env.USE_POLLINATIONS !== "false") {
    return "pollinations";
  }

  if (process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY) {
    return "huggingface";
  }

  return "pollinations";
};

const IMAGE_PROVIDER = getDefaultProvider();

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

// AI Image Generator Service
export class AIImageGeneratorService {
  constructor() {
    this.provider = IMAGE_PROVIDER;
    this.model = this.getProviderModel(IMAGE_PROVIDER);
    this.defaultSize = IMAGE_GENERATION_CONSTANTS.DEFAULT_SIZE;
    this.defaultQuality = IMAGE_GENERATION_CONSTANTS.DEFAULT_QUALITY;
    this.defaultStyle = IMAGE_GENERATION_CONSTANTS.DEFAULT_STYLE;
    this.timeout = IMAGE_GENERATION_CONSTANTS.DEFAULT_TIMEOUT;

    console.log(
      `🎨 Image Generator initialized with provider: ${this.provider} (${this.model})`
    );
  }

  // Get model name based on provider
  getProviderModel(provider) {
    return PROVIDER_MODELS[provider] || PROVIDER_MODELS.openai;
  }

  // Generate image using selected provider
  // Supports: Pollinations (free, no API key), Hugging Face, DALL·E 3
  async generateImage(prompt, options = {}) {
    const { saveToStorage = true, userId = null, provider = null } = options;
    const activeProvider = provider || this.provider;

    // Route to appropriate provider
    switch (activeProvider) {
      case "pollinations":
        return await this.generateImageWithPollinations(prompt, options);
      case "huggingface":
      case "hf":
        return await this.generateImageWithHuggingFace(prompt, options);
      case "openai":
      case "dalle":
      default:
        return await this.generateImageWithDALLE(prompt, options);
    }
  }

  // Generate image using DALL·E 3
  async generateImageWithDALLE(prompt, options = {}) {
    const { saveToStorage = true, userId = null } = options;
    const {
      size = "1024x1024",
      quality = "standard", // "standard" or "hd"
      style = "vivid", // Multiple style options supported
      n = 1, // Number of images (DALL·E 3 only supports 1)
    } = options;

    // Validate size options for DALL·E 3
    const validSizes = ["1024x1024", "1792x1024", "1024x1792"];
    if (!validSizes.includes(size)) {
      throw new Error(
        `Invalid size. DALL·E 3 supports: ${validSizes.join(", ")}`
      );
    }

    // Validate quality
    if (!["standard", "hd"].includes(quality)) {
      throw new Error('Quality must be "standard" or "hd"');
    }

    // Validate style - now supports multiple custom styles
    const validStyles = this.getSupportedStyles();
    if (!validStyles.includes(style.toLowerCase())) {
      throw new Error(
        `Invalid style. Supported styles: ${validStyles.join(", ")}`
      );
    }

    // Map custom style to prompt enhancement and DALL·E style
    const styleMapping = this.mapStyleToPrompt(style.toLowerCase(), prompt);
    const enhancedPrompt = styleMapping.enhancedPrompt;
    const dalleStyle = styleMapping.dalleStyle;
    const originalStyle = styleMapping.originalStyle;

    // DALL·E 3 only supports 1 image per request
    if (n !== 1) {
      console.warn(
        "⚠️ DALL·E 3 only supports generating 1 image per request. Setting n=1."
      );
    }

    try {
      const client = getOpenAIClient();
      console.log("🎨 Generating image with DALL·E 3...");

      const startTime = Date.now();

      // Retry logic for transient failures
      let response;
      const maxRetries = IMAGE_GENERATION_CONSTANTS.MAX_RETRIES;
      const retryDelay = IMAGE_GENERATION_CONSTANTS.RETRY_DELAY;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          response = await client.images.generate({
            model: this.model,
            prompt: enhancedPrompt,
            n: 1,
            size: size,
            quality: quality,
            style: dalleStyle,
          });
          break; // Success, exit retry loop
        } catch (error) {
          // Check if it's a retryable error
          const isRetryable =
            IMAGE_GENERATION_CONSTANTS.RETRYABLE_STATUS_CODES.includes(
              error.status
            ) ||
            IMAGE_GENERATION_CONSTANTS.RETRYABLE_ERROR_CODES.includes(
              error.code
            );

          if (!isRetryable || attempt === maxRetries) {
            throw error;
          }

          console.warn(
            `⚠️ Attempt ${attempt}/${maxRetries} failed, retrying in ${
              retryDelay * attempt
            }ms...`,
            error.message
          );
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay * attempt)
          ); // Exponential backoff
        }
      }

      const duration = Date.now() - startTime;

      if (!response.data || response.data.length === 0) {
        throw new Error("No image generated");
      }

      const imageData = response.data[0];
      const dalleImageUrl = imageData.url; // Temporary DALL·E URL (expires in ~1 hour)

      // Download and save image to permanent storage if requested
      let permanentImageUrl = dalleImageUrl;
      let imageStorageInfo = null;

      if (saveToStorage && userId) {
        try {
          console.log("💾 Saving image to permanent storage...");
          const storageResult = await downloadAndSaveImage(
            dalleImageUrl,
            userId
          );
          permanentImageUrl = storageResult.publicUrl;
          imageStorageInfo = {
            localPath: storageResult.localPath,
            fileName: storageResult.fileName,
            fileSize: storageResult.fileSize,
          };
          console.log(
            "✅ Image saved to permanent storage:",
            permanentImageUrl
          );
        } catch (storageError) {
          console.error(
            "⚠️ Failed to save image to storage, using DALL·E URL:",
            storageError.message
          );
          // Continue with DALL·E URL if storage fails (non-critical)
        }
      }

      return buildImageResponse({
        imageUrl: permanentImageUrl,
        dalleImageUrl: dalleImageUrl,
        enhancedPrompt: imageData.revised_prompt || enhancedPrompt,
        originalPrompt: prompt,
        size: size,
        quality: quality,
        style: originalStyle,
        duration: duration,
        model: this.model,
        provider: "openai",
        storageInfo: imageStorageInfo,
      });
    } catch (error) {
      console.error("❌ Image generation error:", error);

      throw new Error(
        `Image generation failed: ${error.message || "Unknown error"}`
      );
    }
  }

  // Generate image using Pollinations.AI (FREE, no API key needed!)
  async generateImageWithPollinations(prompt, options = {}) {
    const { saveToStorage = true, userId = null } = options;
    const {
      size = "1024x1024",
      quality = "standard", // Not used, kept for compatibility
      style = "vivid",
    } = options;

    // Map size
    const [width, height] = size.split("x").map(Number);

    // Map style to model
    const model = POLLINATIONS_MODELS[style.toLowerCase()] || "flux";

    // Map custom style to prompt enhancement
    const styleMapping = this.mapStyleToPrompt(style.toLowerCase(), prompt);
    const enhancedPrompt = styleMapping.enhancedPrompt;
    const originalStyle = styleMapping.originalStyle;

    try {
      console.log(
        "🎨 Generating image with Pollinations.AI (FREE - No API key)..."
      );

      const startTime = Date.now();

      // Generate with Pollinations
      const pollinationsResult = await generatePollinationsImage(
        enhancedPrompt,
        {
          width: width,
          height: height,
          model: model,
        }
      );

      const duration = Date.now() - startTime;
      const imageUrl = pollinationsResult.imageUrl; // Direct URL

      // Download and save image to permanent storage if requested
      let permanentImageUrl = imageUrl;
      let imageStorageInfo = null;

      if (saveToStorage && userId) {
        try {
          console.log("💾 Saving Pollinations image to permanent storage...");
          const storageResult = await downloadAndSaveImage(imageUrl, userId);
          permanentImageUrl = storageResult.publicUrl;
          imageStorageInfo = {
            localPath: storageResult.localPath,
            fileName: storageResult.fileName,
            fileSize: storageResult.fileSize,
          };
          console.log(
            "✅ Pollinations image saved to permanent storage:",
            permanentImageUrl
          );
        } catch (storageError) {
          console.error(
            "⚠️ Failed to save Pollinations image to storage, using original URL:",
            storageError.message
          );
        }
      }

      return buildImageResponse({
        imageUrl: permanentImageUrl,
        dalleImageUrl: imageUrl,
        enhancedPrompt: enhancedPrompt,
        originalPrompt: prompt,
        size: size,
        quality: quality,
        style: originalStyle,
        duration: duration,
        model: model,
        provider: "pollinations",
        storageInfo: imageStorageInfo,
        isFree: true,
      });
    } catch (error) {
      console.error("❌ Pollinations image generation error:", error);

      throw new Error(
        `Pollinations image generation failed: ${
          error.message || "Unknown error"
        }`
      );
    }
  }

  // Generate image using Hugging Face
  async generateImageWithHuggingFace(prompt, options = {}) {
    const { saveToStorage = true, userId = null } = options;
    const {
      size = "1024x1024",
      quality = "standard",
      style = "vivid",
    } = options;

    // Map custom style to prompt enhancement
    const styleMapping = this.mapStyleToPrompt(style.toLowerCase(), prompt);
    const enhancedPrompt = styleMapping.enhancedPrompt;
    const originalStyle = styleMapping.originalStyle;

    try {
      console.log("🎨 Generating image with Hugging Face...");

      const startTime = Date.now();

      const hfResult = await generateHuggingFaceImage(enhancedPrompt, {
        size: size,
      });

      const duration = Date.now() - startTime;
      let imageUrl = hfResult.imageUrl; // Base64 data URL

      // Download and save to permanent storage
      let permanentImageUrl = imageUrl;
      let imageStorageInfo = null;

      // For base64 images, save to permanent storage
      if (saveToStorage && userId && imageUrl.startsWith("data:image")) {
        try {
          console.log("💾 Saving Hugging Face image to permanent storage...");
          const storageResult = await saveBase64Image(imageUrl, userId, "hf");
          permanentImageUrl = storageResult.publicUrl;
          imageStorageInfo = {
            localPath: storageResult.localPath,
            fileName: storageResult.fileName,
            fileSize: storageResult.fileSize,
          };
          console.log("✅ Hugging Face image saved:", permanentImageUrl);
        } catch (storageError) {
          console.error(
            "⚠️ Failed to save Hugging Face image:",
            storageError.message
          );
        }
      }

      return buildImageResponse({
        imageUrl: permanentImageUrl,
        dalleImageUrl: imageUrl,
        enhancedPrompt: enhancedPrompt,
        originalPrompt: prompt,
        size: size,
        quality: quality,
        style: originalStyle,
        duration: duration,
        model: "stabilityai/stable-diffusion-xl-base-1.0",
        provider: "huggingface",
        storageInfo: imageStorageInfo,
      });
    } catch (error) {
      console.error("❌ Hugging Face image generation error:", error);
      throw new Error(
        `Hugging Face image generation failed: ${
          error.message || "Unknown error"
        }`
      );
    }
  }

  // Mock image generation for development/testing
  generateMockImage(prompt, options = {}) {
    const {
      size = "1024x1024",
      quality = "standard",
      style = "vivid",
    } = options;

    // Map style for mock too
    const styleMapping = this.mapStyleToPrompt(style.toLowerCase(), prompt);
    const enhancedPrompt = styleMapping.enhancedPrompt;
    const originalStyle = styleMapping.originalStyle;

    // Generate a placeholder image URL (using placeholder.com or similar)
    const mockImageUrl = `https://via.placeholder.com/${size.replace(
      "x",
      "x"
    )}/4F46E5/FFFFFF?text=${encodeURIComponent(
      enhancedPrompt.substring(0, 50)
    )}`;

    return {
      success: true,
      imageUrl: mockImageUrl,
      dalleImageUrl: mockImageUrl, // Same for mock
      revisedPrompt: enhancedPrompt,
      originalPrompt: prompt,
      size: size,
      quality: quality,
      style: originalStyle,
      duration: 1500, // Mock delay
      model: "dall-e-3-mock",
      isMock: true,
      isStored: false, // Mock images aren't stored
      storageInfo: null,
    };
  }

  // Generate multiple variations (using DALL·E 2 if needed, or sequential calls)
  async generateImageVariations(imageUrl, options = {}) {
    // Note: DALL·E 3 doesn't support variations directly
    // This would require using DALL·E 2 or implementing custom logic
    throw new Error(
      "Image variations not yet implemented. DALL·E 3 doesn't support variations directly."
    );
  }

  // Edit image (using image editing API)
  async editImage(imageUrl, prompt, options = {}) {
    // Note: DALL·E 3 doesn't support editing directly
    // This would require using DALL·E 2 or other image editing services
    throw new Error(
      "Image editing not yet implemented. DALL·E 3 doesn't support editing directly."
    );
  }

  // Get supported sizes (based on active provider)
  getSupportedSizes() {
    switch (this.provider) {
      case "pollinations":
        return ["512x512", "768x768", "1024x1024", "1280x720", "720x1280"];
      case "huggingface":
      case "hf":
        return ["512x512", "768x768", "1024x1024"]; // Common SD sizes
      case "openai":
      default:
        return ["1024x1024", "1792x1024", "1024x1792"]; // DALL·E 3 sizes
    }
  }

  // Get supported qualities
  getSupportedQualities() {
    return SUPPORTED_QUALITIES;
  }

  // Get supported styles
  getSupportedStyles() {
    return SUPPORTED_STYLES;
  }

  // Map custom styles to prompt enhancements and DALL·E style
  mapStyleToPrompt(style, originalPrompt) {
    const enhancement =
      STYLE_ENHANCEMENTS[style.toLowerCase()] || STYLE_ENHANCEMENTS.vivid;

    return {
      enhancedPrompt: enhancement.prompt + originalPrompt,
      dalleStyle: enhancement.dalleStyle,
      originalStyle: style,
    };
  }

  // Validate prompt for image generation
  validatePrompt(prompt) {
    if (!prompt || typeof prompt !== "string") {
      throw new Error("Prompt must be a non-empty string");
    }

    const minLength = IMAGE_GENERATION_CONSTANTS.MIN_PROMPT_LENGTH;
    const maxLength = IMAGE_GENERATION_CONSTANTS.MAX_PROMPT_LENGTH;

    if (prompt.length < minLength) {
      throw new Error(`Prompt must be at least ${minLength} characters long`);
    }

    if (prompt.length > maxLength) {
      throw new Error(`Prompt must be less than ${maxLength} characters`);
    }

    return true;
  }
}

// Export singleton instance
export const aiImageGeneratorService = new AIImageGeneratorService();
