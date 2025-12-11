import { body } from "express-validator";

// Service validation middleware
export const validateTextGeneration = [
  body("prompt")
    .trim()
    .notEmpty()
    .withMessage("Prompt is required")
    .isLength({ min: 10, max: 1000 })
    .withMessage("Prompt must be between 10 and 1000 characters"),

  body("contentType")
    .isIn([
      "blog_post",
      "social_media",
      "email",
      "product_description",
      "ad_copy",
      "general",
    ])
    .withMessage(
      "Content type must be one of: blog_post, social_media, email, product_description, ad_copy, general"
    ),

  body("tone")
    .optional()
    .isIn([
      "professional",
      "casual",
      "creative",
      "persuasive",
      "friendly",
      "formal",
    ])
    .withMessage(
      "Tone must be one of: professional, casual, creative, persuasive, friendly, formal"
    ),

  body("length")
    .optional()
    .isIn(["short", "medium", "long"])
    .withMessage("Length must be one of: short, medium, long"),

  body("language")
    .optional()
    .isLength({ min: 2, max: 10 })
    .withMessage("Language must be between 2 and 10 characters"),
];

// Image Generation Validation
export const validateImageGeneration = [
  body("prompt")
    .trim()
    .notEmpty()
    .withMessage("Prompt is required")
    .isLength({ min: 3, max: 4000 })
    .withMessage("Prompt must be between 3 and 4000 characters"),

  body("size")
    .optional()
    .isIn(["1024x1024", "1792x1024", "1024x1792"])
    .withMessage("Size must be one of: 1024x1024, 1792x1024, 1024x1792"),

  body("quality")
    .optional()
    .isIn(["standard", "hd"])
    .withMessage('Quality must be "standard" or "hd"'),

  body("style")
    .optional()
    .isIn([
      "vivid",
      "natural",
      "realistic",
      "artistic",
      "anime",
      "3d-render",
      "oil-painting",
      "watercolor",
    ])
    .withMessage(
      "Style must be one of: vivid, natural, realistic, artistic, anime, 3d-render, oil-painting, watercolor"
    ),
];

// Video Generation Validation
export const validateVideoGeneration = [
  body("prompt")
    .trim()
    .notEmpty()
    .withMessage("Prompt is required")
    .isLength({ min: 3, max: 4000 })
    .withMessage("Prompt must be between 3 and 4000 characters"),

  body("duration")
    .optional()
    .isIn([3, 5, 10, 15, 30])
    .withMessage("Duration must be one of: 3, 5, 10, 15, 30 seconds"),

  body("resolution")
    .optional()
    .isIn(["720p", "1080p"])
    .withMessage('Resolution must be "720p" or "1080p"'),

  body("aspectRatio")
    .optional()
    .isIn(["16:9", "9:16", "1:1"])
    .withMessage('Aspect ratio must be one of: "16:9", "9:16", "1:1"'),

  body("fps")
    .optional()
    .isInt({ min: 15, max: 60 })
    .withMessage("FPS must be between 15 and 60"),

  body("style")
    .optional()
    .isIn([
      "cinematic",
      "realistic",
      "artistic",
      "animated",
      "documentary",
      "futuristic",
    ])
    .withMessage(
      "Style must be one of: cinematic, realistic, artistic, animated, documentary, futuristic"
    ),
];

// Future validation for other services can be added here:
// export const validateSearchQuery = [...];
// export const validateChatbotCreation = [...];
