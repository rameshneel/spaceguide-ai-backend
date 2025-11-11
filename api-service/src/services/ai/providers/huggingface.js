import axios from "axios";

// Lazy-loaded Hugging Face config
let huggingfaceConfig = null;

/**
 * Initialize Hugging Face Inference API configuration
 * Free tier available: https://huggingface.co/inference-api
 */
export const getHuggingFaceConfig = () => {
  if (!huggingfaceConfig) {
    const apiKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY;

    if (!apiKey) {
      throw new Error(
        "HUGGINGFACE_API_KEY or HF_API_KEY environment variable is required"
      );
    }

    huggingfaceConfig = {
      apiKey: apiKey,
      baseURL: "https://api-inference.huggingface.co/models",
      timeout: 120000, // 2 minutes (HF can be slow)
    };
  }
  return huggingfaceConfig;
};

/**
 * Generate image using Hugging Face Inference API
 * Models: stabilityai/stable-diffusion-xl-base-1.0, runwayml/stable-diffusion-v1-5, etc.
 * @param {string} prompt - Image generation prompt
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Image generation result
 */
export const generateHuggingFaceImage = async (prompt, options = {}) => {
  const {
    model = "stabilityai/stable-diffusion-xl-base-1.0", // Popular free model
    size = "1024x1024", // Not all models support size parameter
    negative_prompt = null,
    num_inference_steps = 20,
    guidance_scale = 7.5,
  } = options;

  const config = getHuggingFaceConfig();

  try {
    console.log("🎨 Generating image with Hugging Face...");

    const requestBody = {
      inputs: prompt,
      parameters: {
        num_inference_steps: num_inference_steps,
        guidance_scale: guidance_scale,
      },
    };

    if (negative_prompt) {
      requestBody.parameters.negative_prompt = negative_prompt;
    }

    // Hugging Face returns image as blob/binary
    const response = await axios.post(
      `${config.baseURL}/${model}`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
        timeout: config.timeout,
        responseType: "arraybuffer", // Binary response
      }
    );

    // Convert binary to base64
    const base64Image = Buffer.from(response.data, "binary").toString("base64");
    const imageUrl = `data:image/png;base64,${base64Image}`;

    return {
      success: true,
      imageUrl: imageUrl,
      base64Image: base64Image,
      model: model,
      provider: "huggingface",
    };
  } catch (error) {
    console.error("❌ Hugging Face image generation error:", error.message);

    // Hugging Face may return model loading status
    if (error.response?.status === 503) {
      const estimatedTime = error.response.data?.estimated_time || 60;
      throw new Error(
        `Hugging Face model is loading. Please wait ~${estimatedTime} seconds and try again.`
      );
    }

    throw new Error(
      `Hugging Face image generation failed: ${
        error.response?.data?.error || error.message
      }`
    );
  }
};

/**
 * Get supported models for Hugging Face
 */
export const getHuggingFaceModels = () => {
  return [
    {
      id: "stabilityai/stable-diffusion-xl-base-1.0",
      name: "Stable Diffusion XL",
      description: "High quality image generation",
    },
    {
      id: "runwayml/stable-diffusion-v1-5",
      name: "Stable Diffusion v1.5",
      description: "Fast and reliable",
    },
    {
      id: "CompVis/stable-diffusion-v1-4",
      name: "Stable Diffusion v1.4",
      description: "Original SD model",
    },
  ];
};
