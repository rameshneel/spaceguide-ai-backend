import sanitizeHtml from "sanitize-html";

/**
 * Sanitize user input to prevent XSS attacks
 * @param {string} input - User input to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized string
 */
export const sanitizeInput = (input, options = {}) => {
  if (!input || typeof input !== "string") {
    return "";
  }

  const defaultOptions = {
    allowedTags: [], // No HTML tags allowed
    allowedAttributes: {},
    allowedIframeHostnames: [],
    allowedSchemes: [],
    allowedSchemesByTag: {},
    allowedSchemesAppliedToAttributes: [],
    allowProtocolRelative: false,
    enforceHtmlBoundary: true,
  };

  return sanitizeHtml(input, { ...defaultOptions, ...options }).trim();
};

/**
 * Sanitize chatbot query input
 * @param {string} query - Chatbot query
 * @returns {string} Sanitized query
 */
export const sanitizeQuery = (query) => {
  return sanitizeInput(query, {
    allowedTags: [], // No HTML allowed in queries
    allowedAttributes: {},
  });
};

/**
 * Sanitize chatbot name/description
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
export const sanitizeText = (text) => {
  if (!text) return "";
  return sanitizeInput(text, {
    allowedTags: [], // No HTML allowed
    allowedAttributes: {},
  });
};

/**
 * Sanitize system prompt
 * @param {string} prompt - System prompt
 * @returns {string} Sanitized prompt
 */
export const sanitizeSystemPrompt = (prompt) => {
  return sanitizeInput(prompt, {
    allowedTags: [], // No HTML in system prompts
    allowedAttributes: {},
  });
};
