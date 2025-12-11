import axios from "axios";

/**
 * Pollinations.AI - Completely FREE, no API key required!
 * Website: https://pollinations.ai/
 * API: https://pollinations.ai/api
 */

/**
 * Generate image using Pollinations.AI (Free, no API key needed)
 * @param {string} prompt - Image generation prompt
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Image generation result
 */
export const generatePollinationsImage = async (prompt, options = {}) => {
  const {
    width = 1024,
    height = 1024,
    model = "flux", // flux, flux-dev, flux-schnell, sdxl, etc.
    nsfw = false,
    seed = null,
    aspect_ratio = null,
  } = options;

  try {
    console.log(
      "🎨 Generating image with Pollinations.AI (FREE - No API key needed)..."
    );

    // Build URL with parameters (Pollinations API format)
    // Format: https://image.pollinations.ai/prompt/{prompt}?width=1024&height=1024&model=flux
    const baseUrl = "https://image.pollinations.ai/prompt";
    const params = new URLSearchParams({
      width: width.toString(),
      height: height.toString(),
      model: model,
    });

    if (seed !== null) {
      params.append("seed", seed.toString());
    }

    if (aspect_ratio) {
      params.append("aspect_ratio", aspect_ratio);
    }

    // Encode prompt in URL path, then add query params
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `${baseUrl}/${encodedPrompt}?${params.toString()}`;

    // Pollinations returns direct image URL
    return {
      success: true,
      imageUrl: imageUrl, // Direct URL to generated image
      dalleImageUrl: imageUrl, // Same URL
      model: model,
      provider: "pollinations",
      width: width,
      height: height,
      isFree: true,
    };
  } catch (error) {
    console.error("❌ Pollinations.AI image generation error:", error.message);
    throw new Error(
      `Pollinations.AI image generation failed: ${error.message}`
    );
  }
};

/**
 * Get supported models for Pollinations
 */
export const getPollinationsModels = () => {
  return [
    { id: "flux", name: "Flux", description: "High quality" },
    { id: "flux-dev", name: "Flux Dev", description: "Development version" },
    {
      id: "flux-schnell",
      name: "Flux Schnell",
      description: "Fast generation",
    },
    { id: "sdxl", name: "Stable Diffusion XL", description: "SDXL model" },
    { id: "dalle", name: "DALL-E Mini", description: "Quick generation" },
  ];
};
