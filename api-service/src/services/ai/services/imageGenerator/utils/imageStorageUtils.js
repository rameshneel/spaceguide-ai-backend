import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { getImageUrl } from "../../../../../utils/urlUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Save base64 image to permanent storage
 * @param {string} base64ImageUrl - Base64 data URL (data:image/png;base64,...)
 * @param {string} userId - User ID for organizing images
 * @param {string} providerPrefix - Provider prefix for filename (e.g., "stability", "hf")
 * @returns {Promise<{localPath: string, publicUrl: string, fileName: string, fileSize: number}>}
 */
export const saveBase64Image = async (
  base64ImageUrl,
  userId,
  providerPrefix = "img"
) => {
  try {
    // Extract base64 data
    if (!base64ImageUrl.startsWith("data:image")) {
      throw new Error("Invalid base64 image format");
    }

    const base64Data = base64ImageUrl.split(",")[1];
    const buffer = Buffer.from(base64Data, "base64");

    // Get images directory path
    const imagesDir = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "public",
      "generated-images",
      userId.toString()
    );
    await fs.mkdir(imagesDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString("hex");
    const fileName = `${providerPrefix}-${timestamp}-${randomHash}.png`;
    const filePath = path.join(imagesDir, fileName);

    // Save file
    await fs.writeFile(filePath, buffer);

    // Generate public URL (relative path)
    const publicUrl = `/generated-images/${userId}/${fileName}`;

    // Generate full URL (with host and port)
    const fullUrl = getImageUrl(publicUrl);

    return {
      localPath: filePath,
      publicUrl: publicUrl, // Relative path
      fullUrl: fullUrl, // Full URL with host and port
      fileName: fileName,
      fileSize: buffer.length,
    };
  } catch (error) {
    console.error("❌ Error saving base64 image:", error.message);
    throw new Error(`Failed to save base64 image: ${error.message}`);
  }
};

/**
 * Build standardized image response
 * @param {Object} params - Response parameters
 * @param {string} params.imageUrl - Permanent image URL
 * @param {string} [params.dalleImageUrl] - Original provider URL
 * @param {string} params.enhancedPrompt - Enhanced/revised prompt
 * @param {string} params.originalPrompt - Original user prompt
 * @param {string} params.size - Image size (e.g., "1024x1024")
 * @param {string} params.quality - Image quality ("standard" | "hd")
 * @param {string} params.style - Image style
 * @param {number} params.duration - Generation time in ms
 * @param {string} params.model - Model used
 * @param {string} params.provider - Provider name
 * @param {Object} [params.storageInfo] - Storage information
 * @param {boolean} [params.isFree=false] - Whether provider is free
 * @returns {Object} Standardized response object
 */
export const buildImageResponse = ({
  imageUrl,
  dalleImageUrl,
  enhancedPrompt,
  originalPrompt,
  size,
  quality,
  style,
  duration,
  model,
  provider,
  storageInfo = null,
  isFree = false,
}) => {
  // Generate full URL if storageInfo has fullUrl, otherwise construct from imageUrl
  const fullImageUrl = storageInfo?.fullUrl || getImageUrl(imageUrl);

  return {
    success: true,
    imageUrl: imageUrl, // Relative path (e.g., "/generated-images/userId/file.png")
    fullUrl: fullImageUrl, // Full URL with host and port (e.g., "http://localhost:5000/generated-images/userId/file.png")
    dalleImageUrl: dalleImageUrl || imageUrl,
    revisedPrompt: enhancedPrompt,
    originalPrompt: originalPrompt,
    size: size,
    quality: quality,
    style: style,
    duration: duration,
    model: model,
    provider: provider,
    storageInfo: storageInfo,
    isStored: !!storageInfo,
    isFree: isFree,
  };
};
