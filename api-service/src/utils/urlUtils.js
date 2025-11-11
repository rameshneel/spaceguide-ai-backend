/**
 * URL Utility Functions
 * Helper functions for constructing full URLs with proper host and port
 */

/**
 * Get base URL for the API server
 * @returns {string} Base URL (e.g., "http://localhost:5000")
 */
export const getBaseUrl = () => {
  // Use environment variable if set
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }

  // Use API_URL if set (common convention)
  if (process.env.API_URL) {
    return process.env.API_URL;
  }

  // Default based on environment
  const port = process.env.PORT || 5000;
  const host = process.env.HOST || "localhost";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

  return `${protocol}://${host}:${port}`;
};

/**
 * Construct full URL for generated images
 * @param {string} imagePath - Image path (e.g., "/generated-images/userId/filename.png")
 * @returns {string} Full URL (e.g., "http://localhost:5000/generated-images/userId/filename.png")
 */
export const getImageUrl = (imagePath) => {
  // If already a full URL, return as is
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  // Ensure path starts with /
  const path = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;

  // Get base URL and append path
  const baseUrl = getBaseUrl();
  return `${baseUrl}${path}`;
};

/**
 * Construct full URL for API endpoints
 * @param {string} endpoint - API endpoint (e.g., "/api/services/image/generate")
 * @returns {string} Full URL
 */
export const getApiUrl = (endpoint) => {
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const baseUrl = getBaseUrl();
  return `${baseUrl}${path}`;
};

/**
 * Get image URL with query parameters
 * @param {string} imagePath - Image path
 * @param {Object} params - Query parameters (optional)
 * @returns {string} Full URL with query string
 */
export const getImageUrlWithParams = (imagePath, params = {}) => {
  const url = getImageUrl(imagePath);

  if (Object.keys(params).length === 0) {
    return url;
  }

  const queryString = new URLSearchParams(params).toString();
  return `${url}?${queryString}`;
};
