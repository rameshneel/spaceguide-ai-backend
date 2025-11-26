// Video Generator Constants
export const VIDEO_GENERATION_CONSTANTS = {
  // Timeouts (videos take longer than images)
  DEFAULT_TIMEOUT: 300000, // 5 minutes for video generation
  RETRY_DELAY: 5000, // 5 seconds
  MAX_RETRIES: 3,
  POLLING_INTERVAL: 10000, // 10 seconds - check status every 10s

  // Video Limits
  MIN_PROMPT_LENGTH: 3,
  MAX_PROMPT_LENGTH: 4000,

  // Default Values
  DEFAULT_DURATION: 5, // seconds
  DEFAULT_RESOLUTION: "720p", // 720p, 1080p
  DEFAULT_FPS: 24, // frames per second
  DEFAULT_ASPECT_RATIO: "16:9",

  // Retryable HTTP Status Codes
  RETRYABLE_STATUS_CODES: [429, 500, 502, 503, 504],

  // Retryable Error Codes
  RETRYABLE_ERROR_CODES: ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND"],

  // Qwen API Configuration
  QWEN_API_BASE_URL: "https://dashscope.aliyuncs.com/api/v1",
  QWEN_VIDEO_MODEL: "qwen-vl-max", // Qwen video generation model
};

// Supported Resolutions
export const SUPPORTED_RESOLUTIONS = ["720p", "1080p"];

// Supported Durations (in seconds)
export const SUPPORTED_DURATIONS = [3, 5, 10, 15, 30];

// Supported Aspect Ratios
export const SUPPORTED_ASPECT_RATIOS = [
  { value: "16:9", label: "Landscape (16:9)", width: 1920, height: 1080 },
  { value: "9:16", label: "Portrait (9:16)", width: 1080, height: 1920 },
  { value: "1:1", label: "Square (1:1)", width: 1080, height: 1080 },
];

// Video Style Enhancements
export const VIDEO_STYLE_ENHANCEMENTS = {
  cinematic: {
    prompt: "cinematic, film-like quality, professional cinematography, ",
  },
  realistic: {
    prompt: "photorealistic, highly detailed, natural lighting, ",
  },
  artistic: {
    prompt: "artistic style, creative composition, visually striking, ",
  },
  animated: {
    prompt: "animated style, smooth motion, vibrant colors, ",
  },
  documentary: {
    prompt: "documentary style, natural, authentic, ",
  },
  futuristic: {
    prompt: "futuristic, sci-fi, high-tech, modern, ",
  },
};

// Supported Video Styles
export const SUPPORTED_VIDEO_STYLES = [
  "cinematic",
  "realistic",
  "artistic",
  "animated",
  "documentary",
  "futuristic",
];
