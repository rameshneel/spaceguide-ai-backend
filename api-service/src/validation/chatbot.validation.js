import { body, param, query } from "express-validator";

/**
 * Validation rules for creating a chatbot
 */
export const validateCreateChatbot = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Chatbot name is required")
    .isLength({ min: 3, max: 100 })
    .withMessage("Chatbot name must be between 3 and 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),

  body("config.systemPrompt")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("System prompt cannot exceed 2000 characters"),

  body("config.temperature")
    .optional()
    .isFloat({ min: 0, max: 2 })
    .withMessage("Temperature must be between 0 and 2"),

  body("config.maxTokens")
    .optional()
    .isInt({ min: 50, max: 4000 })
    .withMessage("Max tokens must be between 50 and 4000"),

  body("config.topK")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("TopK must be between 1 and 20"),

  body("config.chunkSize")
    .optional()
    .isInt({ min: 100, max: 5000 })
    .withMessage("Chunk size must be between 100 and 5000"),

  body("config.chunkOverlap")
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage("Chunk overlap must be between 0 and 1000"),

  body("template")
    .optional()
    .trim()
    .custom((value) => {
      if (!value) return true; // Optional field
      const normalizedValue = value.toLowerCase();
      const validTemplates = [
        "customersupport",
        "generalassistant",
        "faqassistant",
      ];
      if (validTemplates.includes(normalizedValue)) {
        return true;
      }
      throw new Error(
        "Invalid template name. Must be one of: customerSupport, generalAssistant, faqAssistant (case-insensitive)"
      );
    })
    .customSanitizer((value) => {
      // Normalize to camelCase for consistency
      if (!value) return value;
      const normalized = value.toLowerCase();
      const templateMap = {
        customersupport: "customerSupport",
        generalassistant: "generalAssistant",
        faqassistant: "faqAssistant",
      };
      return templateMap[normalized] || value;
    }),
];

/**
 * Validation rules for training chatbot with text
 */
export const validateTrainWithText = [
  param("id")
    .notEmpty()
    .withMessage("Chatbot ID is required")
    .isMongoId()
    .withMessage("Invalid chatbot ID"),

  body("text")
    .trim()
    .notEmpty()
    .withMessage("Text content is required")
    .isLength({ min: 100, max: 1000000 }) // Max 1MB text (~1 million characters)
    .withMessage("Text must be between 100 and 1,000,000 characters"),
];

/**
 * Validation rules for querying chatbot
 */
export const validateQueryChatbot = [
  param("id")
    .notEmpty()
    .withMessage("Chatbot ID is required")
    .isMongoId()
    .withMessage("Invalid chatbot ID"),

  body("query")
    .trim()
    .notEmpty()
    .withMessage("Query is required")
    .isLength({ min: 3, max: 1000 })
    .withMessage("Query must be between 3 and 1000 characters"),

  body("sessionId")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Session ID must be between 1 and 100 characters"),
];

/**
 * Validation rules for chatbot ID parameter
 */
export const validateChatbotId = [
  param("id")
    .notEmpty()
    .withMessage("Chatbot ID is required")
    .isMongoId()
    .withMessage("Invalid chatbot ID"),
];

/**
 * Validation rules for widget query
 */
export const validateWidgetQuery = [
  param("id")
    .notEmpty()
    .withMessage("Chatbot ID is required")
    .isMongoId()
    .withMessage("Invalid chatbot ID"),

  body("apiKey").notEmpty().withMessage("API key is required"),

  body("query")
    .trim()
    .notEmpty()
    .withMessage("Query is required")
    .isLength({ min: 3, max: 1000 })
    .withMessage("Query must be between 3 and 1000 characters"),
];

/**
 * Validation rules for updating a chatbot
 */
export const validateUpdateChatbot = [
  param("id")
    .notEmpty()
    .withMessage("Chatbot ID is required")
    .isMongoId()
    .withMessage("Invalid chatbot ID"),

  body("name")
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage("Chatbot name must be between 3 and 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),

  body("config.systemPrompt")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("System prompt cannot exceed 2000 characters"),

  body("config.temperature")
    .optional()
    .isFloat({ min: 0, max: 2 })
    .withMessage("Temperature must be between 0 and 2"),

  body("config.maxTokens")
    .optional()
    .isInt({ min: 50, max: 4000 })
    .withMessage("Max tokens must be between 50 and 4000"),

  body("config.topK")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("TopK must be between 1 and 20"),

  body("config.chunkSize")
    .optional()
    .isInt({ min: 100, max: 5000 })
    .withMessage("Chunk size must be between 100 and 5000"),

  body("config.chunkOverlap")
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage("Chunk overlap must be between 0 and 1000"),
];

/**
 * Validation rules for updating widget settings
 */
export const validateUpdateWidget = [
  param("id")
    .notEmpty()
    .withMessage("Chatbot ID is required")
    .isMongoId()
    .withMessage("Invalid chatbot ID"),

  body("enabled")
    .optional()
    .isBoolean()
    .withMessage("Enabled must be a boolean"),

  body("regenerateApiKey")
    .optional()
    .isBoolean()
    .withMessage("Regenerate API key must be a boolean"),

  body("theme.primaryColor")
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage("Primary color must be a valid hex color"),

  body("theme.backgroundColor")
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage("Background color must be a valid hex color"),

  body("theme.position")
    .optional()
    .isIn(["bottom-right", "bottom-left", "top-right", "top-left"])
    .withMessage(
      "Position must be one of: bottom-right, bottom-left, top-right, top-left"
    ),
];
