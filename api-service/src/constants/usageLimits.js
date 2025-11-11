/**
 * Usage Limit Constants
 * Centralized constants for usage limits and thresholds
 */

export const DEFAULT_WORD_LIMIT = 500;
export const DEFAULT_IMAGE_LIMIT = 3;

// Usage warning thresholds (percentage)
export const USAGE_WARNING_THRESHOLD = 80;
export const USAGE_CRITICAL_THRESHOLD = 95;

// Word estimation by length option
export const WORD_ESTIMATES = {
  short: 150, // Max estimate for short (50-150 words)
  medium: 400, // Estimate for medium (150-400 words)
  long: 500, // Estimate for long (400+ words)
};
