import dotenv from "dotenv";
import { safeLogger as logger } from "../utils/logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables FIRST
// Priority:
// 1. Environment variables already set (from docker-compose env_file or system)
// 2. Single .env file in project root
// 3. .env file in current directory (fallback)

// Check if required variables are already set (from docker-compose env_file)
const hasRequiredVars =
  process.env.ACCESS_TOKEN_SECRET && process.env.REFRESH_TOKEN_SECRET;

if (!hasRequiredVars) {
  const projectRoot = path.join(__dirname, "../..");
  let envLoaded = false;

  // Single .env file from project root
  const envPath = path.join(projectRoot, ".env");
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      logger.debug("Loaded .env file from project root");
      envLoaded = true;
    }
  }

  // Last fallback: try default location (current working directory)
  if (!envLoaded) {
    const result = dotenv.config();
    if (!result.error) {
      logger.debug("Loaded .env file from default location");
    }
  }
} else {
  // Variables already set from env_file or system
  logger.debug(
    "Using environment variables from docker-compose env_file or system"
  );
}

// Required environment variables
const requiredEnvVars = [
  "MONGODB_URI",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
];

// Optional environment variables with sane defaults
const optionalEnvVars = {
  PORT: 5000,
  HOST: "0.0.0.0", // bind all interfaces inside container
  BASE_URL: undefined, // Base URL (auto-generated if not set)
  API_URL: undefined, // Alternative to BASE_URL
  EMBEDDING_PROVIDER: "openai",
  CHAT_PROVIDER: "openai",
  TEXT_WRITER_PROVIDER: "openai", // Default managed provider
  OLLAMA_TEXT_WRITER_MODEL: "mistral:7b", // Used only if TEXT_WRITER_PROVIDER=ollama
  RATE_LIMIT_WINDOW_MS: "900000", // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: "100",
  FRONTEND_URL: "http://localhost:3000",
  CORS_ORIGINS: undefined, // Comma-separated list of allowed origins
};

// Validate required environment variables
const missingVars = [];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    missingVars.push(varName);
  }
});

if (missingVars.length > 0) {
  const errorMessage = `❌ Missing required environment variables: ${missingVars.join(
    ", "
  )}\nPlease check your .env file or ensure environment variables are set via docker-compose env_file.`;
  logger.error(errorMessage);
  throw new Error(errorMessage);
}

// Set defaults for optional variables (skip undefined values)
Object.entries(optionalEnvVars).forEach(([key, defaultValue]) => {
  if (!process.env[key] && defaultValue !== undefined) {
    process.env[key] = defaultValue;
    logger.debug(`Using default value for ${key}: ${defaultValue}`);
  }
});

// Log configuration (without sensitive data)
logger.info("Environment Configuration:", {
  PORT: process.env.PORT,
  EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
  CHAT_PROVIDER: process.env.CHAT_PROVIDER,
  TEXT_WRITER_PROVIDER: process.env.TEXT_WRITER_PROVIDER,
  OLLAMA_TEXT_WRITER_MODEL: process.env.OLLAMA_TEXT_WRITER_MODEL,
  MONGODB_URI: process.env.MONGODB_URI ? "✓ Set" : "✗ Missing",
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET ? "✓ Set" : "✗ Missing",
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET
    ? "✓ Set"
    : "✗ Missing",
});

export default process.env;
