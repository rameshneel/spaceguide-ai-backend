import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import axios from "axios";
import { getImageUrl } from "../../../../../utils/urlUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Download video from URL and save to permanent storage
 * @param {string} videoUrl - URL of the video to download
 * @param {string} userId - User ID for organizing videos
 * @returns {Promise<{localPath: string, publicUrl: string, fileName: string, fileSize: number}>}
 */
export const downloadAndSaveVideo = async (videoUrl, userId) => {
  try {
    // Get videos directory path
    const videosDir = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "..",
      "public",
      "generated-videos",
      userId.toString()
    );
    await fs.mkdir(videosDir, { recursive: true });

    // Download video
    console.log("📥 Downloading video from:", videoUrl);
    const response = await axios({
      method: "GET",
      url: videoUrl,
      responseType: "arraybuffer",
      timeout: 300000, // 5 minutes timeout for video download
      maxContentLength: 500 * 1024 * 1024, // 500MB max
    });

    // Determine file extension from content-type or URL
    let extension = ".mp4";
    const contentType = response.headers["content-type"];
    if (contentType) {
      if (contentType.includes("webm")) extension = ".webm";
      else if (contentType.includes("mov")) extension = ".mov";
      else if (contentType.includes("avi")) extension = ".avi";
    } else if (videoUrl.includes(".webm")) {
      extension = ".webm";
    } else if (videoUrl.includes(".mov")) {
      extension = ".mov";
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString("hex");
    const fileName = `video-${timestamp}-${randomHash}${extension}`;
    const filePath = path.join(videosDir, fileName);

    // Save video to disk
    await fs.writeFile(filePath, response.data);
    console.log("✅ Video saved to:", filePath);

    // Generate public URL (relative path)
    const publicUrl = `/generated-videos/${userId}/${fileName}`;

    // Generate full URL (with host and port)
    const fullUrl = getImageUrl(publicUrl); // Reuse image URL utility

    return {
      localPath: filePath,
      publicUrl: publicUrl, // Relative path
      fullUrl: fullUrl, // Full URL with host and port
      fileName: fileName,
      fileSize: response.data.length, // Size in bytes
    };
  } catch (error) {
    console.error("❌ Error downloading/saving video:", error.message);
    throw new Error(`Failed to download and save video: ${error.message}`);
  }
};

/**
 * Build standardized video response
 * @param {Object} params - Response parameters
 * @param {string} params.videoUrl - Permanent video URL
 * @param {string} [params.originalVideoUrl] - Original provider URL
 * @param {string} params.enhancedPrompt - Enhanced/revised prompt
 * @param {string} params.originalPrompt - Original user prompt
 * @param {string} params.resolution - Video resolution (e.g., "720p", "1080p")
 * @param {number} params.duration - Video duration in seconds
 * @param {string} params.aspectRatio - Aspect ratio (e.g., "16:9")
 * @param {number} params.fps - Frames per second
 * @param {string} params.style - Video style
 * @param {number} params.generationTime - Generation time in ms
 * @param {string} params.model - Model used
 * @param {string} params.provider - Provider name
 * @param {Object} [params.storageInfo] - Storage information
 * @param {string} [params.status] - Generation status
 * @param {string} [params.taskId] - Task ID for async operations
 * @returns {Object} Standardized response object
 */
export const buildVideoResponse = ({
  videoUrl,
  originalVideoUrl = null,
  enhancedPrompt,
  originalPrompt,
  resolution,
  duration,
  aspectRatio,
  fps,
  style,
  generationTime,
  model,
  provider,
  storageInfo = null,
  status = "completed",
  taskId = null,
}) => {
  return {
    success: true,
    videoUrl: videoUrl, // Permanent video URL
    originalVideoUrl: originalVideoUrl, // Original provider URL (if different)
    fullUrl: videoUrl, // Full URL (same as videoUrl for consistency)
    revisedPrompt: enhancedPrompt,
    originalPrompt: originalPrompt,
    resolution: resolution,
    duration: duration,
    aspectRatio: aspectRatio,
    fps: fps,
    style: style,
    duration: generationTime, // Generation time in ms
    model: model,
    provider: provider,
    isStored: !!storageInfo,
    storageInfo: storageInfo,
    status: status,
    taskId: taskId,
    createdAt: new Date().toISOString(),
  };
};
