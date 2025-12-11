import axios from "axios";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const BASE_URL =
  process.env.VALUATION_BASE_URL || "https://collimationbank.com";
const SEARCH_PATH =
  process.env.VALUATION_SEARCH_PATH || "/search-companies.php";
const LIVE_PATH =
  process.env.VALUATION_LIVE_PATH || "/valuation-live-process.php";

/**
 * Search companies via external valuation API
 * GET /api/valuation/search?query=...
 * External API expects POST with form-data
 */
export const searchCompanies = asyncHandler(async (req, res) => {
  const query = (req.query.query || "").trim();
  if (!query) {
    throw new ApiError(400, "Query is required");
  }

  try {
    // Create form-data payload (application/x-www-form-urlencoded)
    const formData = new URLSearchParams();
    formData.append("query", query);

    const { data } = await axios.post(
      `${BASE_URL}${SEARCH_PATH}`,
      formData.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 15000,
      }
    );

    // Check if external API returned an error
    if (data?.error) {
      throw new ApiError(400, data.error || "Search failed");
    }

    // The external API returns { results: [...] }
    // Ensure we always return an array
    const results = Array.isArray(data?.results) ? data.results : [];

    return res
      .status(200)
      .json(new ApiResponse(200, { results }, "Valuation search success"));
  } catch (error) {
    // If it's already an ApiError, re-throw it
    if (error instanceof ApiError) {
      throw error;
    }

    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Failed to search companies";
    throw new ApiError(status, message);
  }
});

/**
 * Run valuation streaming
 * POST /api/valuation/run
 * body: { symbol: string, token?: string }
 */
export const runValuation = asyncHandler(async (req, res) => {
  const symbol = (req.body.symbol || "").trim();
  const tokenInput = req.body.token || "";

  if (!symbol) {
    throw new ApiError(400, "Symbol is required");
  }

  // Build token payload expected by external API
  const token =
    tokenInput && tokenInput.length > 0
      ? tokenInput
      : `**Valuation Data:**\n\n**Company Profile:** ${symbol}\n`;

  try {
    // External API expects symbol; send as form-urlencoded to be safe
    const formData = new URLSearchParams();
    formData.append("symbol", symbol);
    formData.append("token", token);

    const response = await axios.post(
      `${BASE_URL}${LIVE_PATH}`,
      formData.toString(),
      {
        responseType: "stream",
        timeout: 30000,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    // Stream raw chunks to client
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    response.data.on("data", (chunk) => {
      res.write(chunk);
    });

    response.data.on("end", () => {
      res.end();
    });

    response.data.on("error", (err) => {
      res.end();
      console.error("Valuation stream error:", err);
    });
  } catch (error) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Failed to run valuation";
    throw new ApiError(status, message);
  }
});
