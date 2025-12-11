import axios from "axios";
import {
  VIDEO_GENERATION_CONSTANTS,
  SUPPORTED_RESOLUTIONS,
  SUPPORTED_DURATIONS,
  SUPPORTED_ASPECT_RATIOS,
  VIDEO_STYLE_ENHANCEMENTS,
  SUPPORTED_VIDEO_STYLES,
} from "./constants.js";
import {
  downloadAndSaveVideo,
  buildVideoResponse,
} from "./utils/videoStorageUtils.js";

// Get Qwen API configuration
const getQwenConfig = () => {
  const apiKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "QWEN_API_KEY or DASHSCOPE_API_KEY environment variable is required"
    );
  }
  return {
    apiKey,
    baseUrl:
      process.env.QWEN_API_BASE_URL ||
      VIDEO_GENERATION_CONSTANTS.QWEN_API_BASE_URL,
    model:
      process.env.QWEN_VIDEO_MODEL ||
      VIDEO_GENERATION_CONSTANTS.QWEN_VIDEO_MODEL,
  };
};

/**
 * AI Video Generator Service using Qwen API
 * Industry-level implementation with proper error handling, retries, and storage
 */
export class AIVideoGeneratorService {
  constructor() {
    this.provider = "qwen";
    this.config = null;
    this.defaultDuration = VIDEO_GENERATION_CONSTANTS.DEFAULT_DURATION;
    this.defaultResolution = VIDEO_GENERATION_CONSTANTS.DEFAULT_RESOLUTION;
    this.defaultFps = VIDEO_GENERATION_CONSTANTS.DEFAULT_FPS;
    this.defaultAspectRatio = VIDEO_GENERATION_CONSTANTS.DEFAULT_ASPECT_RATIO;
    this.timeout = VIDEO_GENERATION_CONSTANTS.DEFAULT_TIMEOUT;

    // Initialize config (will throw if API key not set)
    try {
      this.config = getQwenConfig();
      console.log(
        `🎬 Video Generator initialized with provider: ${this.provider} (${this.config.model})`
      );
    } catch (error) {
      console.warn(
        `⚠️ Video Generator initialization warning: ${error.message}`
      );
    }
  }

  /**
   * Generate video using Qwen API
   * @param {string} prompt - Text prompt for video generation
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Video generation result
   */
  async generateVideo(prompt, options = {}) {
    const {
      saveToStorage = true,
      userId = null,
      duration = this.defaultDuration,
      resolution = this.defaultResolution,
      aspectRatio = this.defaultAspectRatio,
      fps = this.defaultFps,
      style = "cinematic",
    } = options;

    // Validate prompt
    this.validatePrompt(prompt);

    // Validate options
    this.validateOptions({ duration, resolution, aspectRatio, fps, style });

    // Check if config is available
    if (!this.config) {
      this.config = getQwenConfig();
    }

    try {
      const startTime = Date.now();

      // Map style to prompt enhancement
      const styleMapping = this.mapStyleToPrompt(style.toLowerCase(), prompt);
      const enhancedPrompt = styleMapping.enhancedPrompt;
      const originalStyle = styleMapping.originalStyle;

      // Map resolution and aspect ratio to dimensions
      const dimensions = this.getVideoDimensions(resolution, aspectRatio);

      console.log("🎬 Generating video with Qwen API...");
      console.log("📝 Prompt:", enhancedPrompt);
      console.log("⚙️ Settings:", {
        duration,
        resolution,
        aspectRatio,
        fps,
        dimensions,
      });

      // Generate video using Qwen API
      // Note: Qwen API may use async task-based approach
      const videoResult = await this.callQwenAPI(enhancedPrompt, {
        duration,
        width: dimensions.width,
        height: dimensions.height,
        fps,
      });

      const generationTime = Date.now() - startTime;

      // Download and save video to permanent storage if requested
      let permanentVideoUrl = videoResult.videoUrl;
      let videoStorageInfo = null;

      if (saveToStorage && userId && videoResult.videoUrl) {
        try {
          console.log("💾 Saving video to permanent storage...");
          const storageResult = await downloadAndSaveVideo(
            videoResult.videoUrl,
            userId
          );
          permanentVideoUrl = storageResult.fullUrl;
          videoStorageInfo = {
            localPath: storageResult.localPath,
            fileName: storageResult.fileName,
            fileSize: storageResult.fileSize,
          };
          console.log(
            "✅ Video saved to permanent storage:",
            permanentVideoUrl
          );
        } catch (storageError) {
          console.error(
            "⚠️ Failed to save video to storage, using original URL:",
            storageError.message
          );
          // Continue with original URL if storage fails (non-critical)
        }
      }

      return buildVideoResponse({
        videoUrl: permanentVideoUrl,
        originalVideoUrl: videoResult.videoUrl,
        enhancedPrompt: enhancedPrompt,
        originalPrompt: prompt,
        resolution: resolution,
        duration: duration,
        aspectRatio: aspectRatio,
        fps: fps,
        style: originalStyle,
        generationTime: generationTime,
        model: this.config.model,
        provider: this.provider,
        storageInfo: videoStorageInfo,
        status: "completed",
        taskId: videoResult.taskId || null,
      });
    } catch (error) {
      console.error("❌ Video generation error:", error);

      throw new Error(
        `Video generation failed: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Call Qwen API for video generation
   * @param {string} prompt - Enhanced prompt
   * @param {Object} params - Video parameters
   * @returns {Promise<Object>} Video result
   */
  async callQwenAPI(prompt, params) {
    const { duration, width, height, fps } = params;

    try {
      // Qwen API endpoint for video generation
      const endpoint = `${this.config.baseUrl}/services/aigc/video-generation/generation`;

      // Prepare request payload
      const payload = {
        model: this.config.model,
        input: {
          prompt: prompt,
        },
        parameters: {
          duration: duration, // seconds
          size: `${width}x${height}`,
          fps: fps,
        },
      };

      // Make API request with retry logic
      let response;
      const maxRetries = VIDEO_GENERATION_CONSTANTS.MAX_RETRIES;
      const retryDelay = VIDEO_GENERATION_CONSTANTS.RETRY_DELAY;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          response = await axios.post(endpoint, payload, {
            headers: {
              Authorization: `Bearer ${this.config.apiKey}`,
              "Content-Type": "application/json",
              "X-DashScope-Async": "enable", // Enable async mode for video generation
            },
            timeout: this.timeout,
          });

          // Check if response indicates async task
          if (response.data.output?.task_id) {
            // Poll for completion
            return await this.pollVideoTask(response.data.output.task_id);
          }

          // If video URL is directly available
          if (response.data.output?.video_url) {
            return {
              videoUrl: response.data.output.video_url,
              taskId: response.data.output.task_id || null,
            };
          }

          break; // Success
        } catch (error) {
          const isRetryable =
            VIDEO_GENERATION_CONSTANTS.RETRYABLE_STATUS_CODES.includes(
              error.response?.status
            ) ||
            VIDEO_GENERATION_CONSTANTS.RETRYABLE_ERROR_CODES.includes(
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
          );
        }
      }

      if (!response || !response.data) {
        throw new Error("Invalid response from Qwen API");
      }

      // Extract video URL from response
      const videoUrl =
        response.data.output?.video_url ||
        response.data.data?.video_url ||
        response.data.video_url;

      if (!videoUrl) {
        throw new Error("No video URL in API response");
      }

      return {
        videoUrl: videoUrl,
        taskId: response.data.output?.task_id || null,
      };
    } catch (error) {
      if (error.response) {
        throw new Error(
          `Qwen API error: ${error.response.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Poll for video generation task completion
   * @param {string} taskId - Task ID from Qwen API
   * @returns {Promise<Object>} Video result
   */
  async pollVideoTask(taskId) {
    const maxPollingAttempts = 30; // 5 minutes max (30 * 10s)
    const pollingInterval = VIDEO_GENERATION_CONSTANTS.POLLING_INTERVAL;
    const statusEndpoint = `${this.config.baseUrl}/tasks/${taskId}`;

    console.log(`🔄 Polling video generation task: ${taskId}`);

    for (let attempt = 0; attempt < maxPollingAttempts; attempt++) {
      try {
        const response = await axios.get(statusEndpoint, {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          timeout: 30000,
        });

        const task = response.data.output || response.data;
        const status = task.task_status || task.status;

        if (status === "SUCCEEDED" || status === "succeeded") {
          const videoUrl =
            task.video_url || task.output?.video_url || task.result?.video_url;

          if (videoUrl) {
            console.log("✅ Video generation completed:", videoUrl);
            return {
              videoUrl: videoUrl,
              taskId: taskId,
            };
          }
        } else if (
          status === "FAILED" ||
          status === "failed" ||
          status === "CANCELLED" ||
          status === "cancelled"
        ) {
          throw new Error(
            `Video generation failed: ${task.message || "Unknown error"}`
          );
        }

        // Still processing, wait and retry
        console.log(
          `⏳ Video generation in progress... (${
            attempt + 1
          }/${maxPollingAttempts})`
        );
        await new Promise((resolve) => setTimeout(resolve, pollingInterval));
      } catch (error) {
        if (error.response?.status === 404) {
          throw new Error(`Task ${taskId} not found`);
        }
        if (attempt === maxPollingAttempts - 1) {
          throw error;
        }
        // Retry on network errors
        await new Promise((resolve) => setTimeout(resolve, pollingInterval));
      }
    }

    throw new Error("Video generation timeout - task took too long");
  }

  /**
   * Get video dimensions from resolution and aspect ratio
   * @param {string} resolution - Resolution (720p, 1080p)
   * @param {string} aspectRatio - Aspect ratio (16:9, 9:16, 1:1)
   * @returns {Object} Width and height
   */
  getVideoDimensions(resolution, aspectRatio) {
    const aspectRatioConfig = SUPPORTED_ASPECT_RATIOS.find(
      (ar) => ar.value === aspectRatio
    );

    if (!aspectRatioConfig) {
      throw new Error(`Unsupported aspect ratio: ${aspectRatio}`);
    }

    const baseHeight = resolution === "1080p" ? 1080 : 720;
    const ratio = aspectRatioConfig.width / aspectRatioConfig.height;
    const width = Math.round(baseHeight * ratio);

    // Ensure width is divisible by 2 (required for video encoding)
    return {
      width: width % 2 === 0 ? width : width + 1,
      height: baseHeight,
    };
  }

  /**
   * Map style to prompt enhancement
   * @param {string} style - Video style
   * @param {string} originalPrompt - Original prompt
   * @returns {Object} Enhanced prompt and original style
   */
  mapStyleToPrompt(style, originalPrompt) {
    const enhancement =
      VIDEO_STYLE_ENHANCEMENTS[style.toLowerCase()] ||
      VIDEO_STYLE_ENHANCEMENTS.cinematic;

    return {
      enhancedPrompt: enhancement.prompt + originalPrompt,
      originalStyle: style,
    };
  }

  /**
   * Validate prompt
   * @param {string} prompt - Prompt to validate
   */
  validatePrompt(prompt) {
    if (!prompt || typeof prompt !== "string") {
      throw new Error("Prompt must be a non-empty string");
    }

    const minLength = VIDEO_GENERATION_CONSTANTS.MIN_PROMPT_LENGTH;
    const maxLength = VIDEO_GENERATION_CONSTANTS.MAX_PROMPT_LENGTH;

    if (prompt.length < minLength) {
      throw new Error(`Prompt must be at least ${minLength} characters long`);
    }

    if (prompt.length > maxLength) {
      throw new Error(`Prompt must be less than ${maxLength} characters`);
    }

    return true;
  }

  /**
   * Validate generation options
   * @param {Object} options - Options to validate
   */
  validateOptions(options) {
    const { duration, resolution, aspectRatio, fps, style } = options;

    if (duration && !SUPPORTED_DURATIONS.includes(duration)) {
      throw new Error(
        `Unsupported duration. Supported: ${SUPPORTED_DURATIONS.join(", ")}`
      );
    }

    if (resolution && !SUPPORTED_RESOLUTIONS.includes(resolution)) {
      throw new Error(
        `Unsupported resolution. Supported: ${SUPPORTED_RESOLUTIONS.join(", ")}`
      );
    }

    if (
      aspectRatio &&
      !SUPPORTED_ASPECT_RATIOS.find((ar) => ar.value === aspectRatio)
    ) {
      throw new Error(
        `Unsupported aspect ratio. Supported: ${SUPPORTED_ASPECT_RATIOS.map(
          (ar) => ar.value
        ).join(", ")}`
      );
    }

    if (fps && (fps < 15 || fps > 60)) {
      throw new Error("FPS must be between 15 and 60");
    }

    if (style && !SUPPORTED_VIDEO_STYLES.includes(style.toLowerCase())) {
      throw new Error(
        `Unsupported style. Supported: ${SUPPORTED_VIDEO_STYLES.join(", ")}`
      );
    }

    return true;
  }

  /**
   * Get supported resolutions
   * @returns {Array<string>} Supported resolutions
   */
  getSupportedResolutions() {
    return SUPPORTED_RESOLUTIONS;
  }

  /**
   * Get supported durations
   * @returns {Array<number>} Supported durations
   */
  getSupportedDurations() {
    return SUPPORTED_DURATIONS;
  }

  /**
   * Get supported aspect ratios
   * @returns {Array<Object>} Supported aspect ratios
   */
  getSupportedAspectRatios() {
    return SUPPORTED_ASPECT_RATIOS;
  }

  /**
   * Get supported styles
   * @returns {Array<string>} Supported styles
   */
  getSupportedStyles() {
    return SUPPORTED_VIDEO_STYLES;
  }

  /**
   * Mock video generation for development/testing
   * @param {string} prompt - Prompt
   * @param {Object} options - Options
   * @returns {Object} Mock video result
   */
  generateMockVideo(prompt, options = {}) {
    const {
      duration = this.defaultDuration,
      resolution = this.defaultResolution,
      aspectRatio = this.defaultAspectRatio,
      fps = this.defaultFps,
      style = "cinematic",
    } = options;

    const styleMapping = this.mapStyleToPrompt(style.toLowerCase(), prompt);
    const enhancedPrompt = styleMapping.enhancedPrompt;
    const originalStyle = styleMapping.originalStyle;

    // Generate a placeholder video URL (using a sample video service)
    const dimensions = this.getVideoDimensions(resolution, aspectRatio);
    const mockVideoUrl = `https://sample-videos.com/video123/mp4/${resolution}/${duration}/sample-video.mp4`;

    return {
      success: true,
      videoUrl: mockVideoUrl,
      originalVideoUrl: mockVideoUrl,
      fullUrl: mockVideoUrl,
      revisedPrompt: enhancedPrompt,
      originalPrompt: prompt,
      resolution: resolution,
      duration: duration,
      aspectRatio: aspectRatio,
      fps: fps,
      style: originalStyle,
      duration: 5000, // Mock generation time
      model: "qwen-video-mock",
      provider: "qwen",
      isStored: false,
      storageInfo: null,
      status: "completed",
      isMock: true,
    };
  }
}

// Export singleton instance
export const aiVideoGeneratorService = new AIVideoGeneratorService();
