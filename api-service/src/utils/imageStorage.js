import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import crypto from "crypto";
import { getImageUrl } from "./urlUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure images directory exists
const IMAGES_DIR = path.join(
  __dirname,
  "..",
  "..",
  "public",
  "generated-images"
);
const PUBLIC_URL_BASE = "/generated-images"; // URL path for serving images

/**
 * Ensure the images directory exists
 */
const ensureImagesDirectory = async () => {
  try {
    await fs.mkdir(IMAGES_DIR, { recursive: true });
  } catch (error) {
    console.error("❌ Error creating images directory:", error);
    throw error;
  }
};

/**
 * Download image from URL and save to local storage
 * @param {string} imageUrl - URL of the image to download
 * @param {string} userId - User ID for organizing images
 * @returns {Promise<{localPath: string, publicUrl: string, fileName: string}>}
 */
export const downloadAndSaveImage = async (imageUrl, userId) => {
  try {
    // Ensure directory exists
    await ensureImagesDirectory();

    // Create user-specific subdirectory
    const userDir = path.join(IMAGES_DIR, userId.toString());
    await fs.mkdir(userDir, { recursive: true });

    // Download image
    console.log("📥 Downloading image from:", imageUrl);
    const response = await axios({
      method: "GET",
      url: imageUrl,
      responseType: "arraybuffer",
      timeout: 30000, // 30 seconds timeout
    });

    // Generate unique filename
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString("hex");
    const fileName = `img-${timestamp}-${randomHash}.png`;
    const filePath = path.join(userDir, fileName);

    // Save image to disk
    await fs.writeFile(filePath, response.data);
    console.log("✅ Image saved to:", filePath);

    // Generate public URL (relative path)
    const publicUrl = `${PUBLIC_URL_BASE}/${userId}/${fileName}`;

    // Generate full URL (with host and port)
    const fullUrl = getImageUrl(publicUrl);

    return {
      localPath: filePath,
      publicUrl: publicUrl, // Relative path (e.g., "/generated-images/userId/file.png")
      fullUrl: fullUrl, // Full URL (e.g., "http://localhost:5000/generated-images/userId/file.png")
      fileName: fileName,
      fileSize: response.data.length, // Size in bytes
    };
  } catch (error) {
    console.error("❌ Error downloading/saving image:", error.message);
    throw new Error(`Failed to download and save image: ${error.message}`);
  }
};

/**
 * Delete image file from storage
 * @param {string} publicUrl - Public URL of the image
 * @returns {Promise<boolean>}
 */
export const deleteImage = async (publicUrl) => {
  try {
    // Extract file path from public URL
    // Format: /generated-images/{userId}/{fileName}
    const urlParts = publicUrl.split("/generated-images/");
    if (urlParts.length !== 2) {
      throw new Error("Invalid image URL format");
    }

    const filePath = path.join(IMAGES_DIR, urlParts[1]);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      console.warn("⚠️ Image file not found:", filePath);
      return false;
    }

    // Delete file
    await fs.unlink(filePath);
    console.log("✅ Image deleted:", filePath);
    return true;
  } catch (error) {
    console.error("❌ Error deleting image:", error.message);
    return false;
  }
};

/**
 * Get image file info
 * @param {string} publicUrl - Public URL of the image
 * @returns {Promise<{exists: boolean, size: number, path: string}>}
 */
export const getImageInfo = async (publicUrl) => {
  try {
    const urlParts = publicUrl.split("/generated-images/");
    if (urlParts.length !== 2) {
      return { exists: false, size: 0, path: null };
    }

    const filePath = path.join(IMAGES_DIR, urlParts[1]);

    try {
      const stats = await fs.stat(filePath);
      return {
        exists: true,
        size: stats.size,
        path: filePath,
      };
    } catch {
      return { exists: false, size: 0, path: null };
    }
  } catch (error) {
    console.error("❌ Error getting image info:", error.message);
    return { exists: false, size: 0, path: null };
  }
};
