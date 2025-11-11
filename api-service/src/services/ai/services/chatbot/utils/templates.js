/**
 * Chatbot Templates - Constant for seeding/initialization
 * These templates are loaded into database on startup
 *
 * Note: Pre-training data auto-load is DISABLED.
 * Chatbots are created empty. Customers must manually add training data after creation.
 * Pre-training data configuration is kept for future use but is not automatically loaded.
 */

import ChatbotTemplate from "../../../../../models/chatbotTemplate.model.js";

export const CHATBOT_TEMPLATES = {
  customerSupport: {
    name: "Customer Support",
    description:
      "Helpful customer support assistant for answering customer queries. You'll need to add your own training data after creation.",
    systemPrompt:
      "You are a friendly and professional customer support agent. Your goal is to help customers with their questions and concerns. Always be polite, empathetic, and solution-oriented. Answer questions based on the provided context. If you don't know the answer, politely let the customer know and suggest they contact support.",
    temperature: 0.7,
    maxTokens: 500,
    config: {
      topK: 5,
      chunkSize: 1000,
      chunkOverlap: 200,
    },
    widget: {
      theme: {
        primaryColor: "#007bff",
        backgroundColor: "#ffffff",
        position: "bottom-right",
      },
    },
    // Pre-training data for immediate testing
    preTrainingData: {
      enabled: true,
      filePath: "public/training-data/customer-support/default.txt",
      description:
        "Sample customer support FAQ, shipping info, returns policy, and contact information",
    },
  },

  generalAssistant: {
    name: "General Assistant",
    description:
      "Versatile AI assistant for general questions and information. You'll need to add your own training data after creation.",
    systemPrompt:
      "You are a helpful and knowledgeable AI assistant. Answer questions clearly and concisely based on the provided context. Be friendly, professional, and informative. If the context doesn't contain enough information, let the user know politely.",
    temperature: 0.7,
    maxTokens: 500,
    config: {
      topK: 5,
      chunkSize: 1000,
      chunkOverlap: 200,
    },
    widget: {
      theme: {
        primaryColor: "#6c757d",
        backgroundColor: "#ffffff",
        position: "bottom-right",
      },
    },
    // Pre-training data for immediate testing
    preTrainingData: {
      enabled: true,
      filePath: "public/training-data/general-assistant/default.txt",
      description:
        "General knowledge base with company info, services, and best practices",
    },
  },

  faqAssistant: {
    name: "FAQ Assistant",
    description:
      "Efficient FAQ bot for quick answers to common questions. You'll need to add your own training data after creation.",
    systemPrompt:
      "You are an FAQ assistant designed to provide quick and accurate answers to frequently asked questions. Keep responses concise and to the point. Answer based on the provided FAQ documentation. If a question isn't covered, suggest related topics or direct users to contact support.",
    temperature: 0.5,
    maxTokens: 300,
    config: {
      topK: 3,
      chunkSize: 600,
      chunkOverlap: 100,
    },
    widget: {
      theme: {
        primaryColor: "#ffc107",
        backgroundColor: "#ffffff",
        position: "bottom-right",
      },
    },
    // Pre-training data for immediate testing
    preTrainingData: {
      enabled: true,
      filePath: "public/training-data/faq-assistant/default.txt",
      description:
        "Common FAQ questions and answers for accounts, products, billing, and support",
    },
  },
};

/**
 * Get template by key from database
 * @param {string} templateKey - Key of the template (e.g., "customerSupport")
 * @returns {Object|null} Template configuration or null if not found
 */
export const getTemplate = async (templateKey) => {
  try {
    // Normalize key to lowercase for consistency
    const normalizedKey = templateKey?.toLowerCase();
    const template = await ChatbotTemplate.findOne({
      key: normalizedKey,
      status: "active",
    });

    if (!template) {
      // Fallback to constant if not found in database (try both original and normalized key)
      return (
        CHATBOT_TEMPLATES[templateKey] ||
        CHATBOT_TEMPLATES[normalizedKey] ||
        null
      );
    }

    // Convert database format to expected format
    return {
      name: template.name,
      description: template.description,
      systemPrompt: template.systemPrompt,
      temperature: template.temperature,
      maxTokens: template.maxTokens,
      config: {
        topK: template.config?.topK || 5,
        chunkSize: template.config?.chunkSize || 1000,
        chunkOverlap: template.config?.chunkOverlap || 200,
      },
      widget: {
        theme: template.widget?.theme || {
          primaryColor: "#007bff",
          backgroundColor: "#ffffff",
          position: "bottom-right",
        },
      },
      preTrainingData: {
        enabled: template.preTrainingData?.enabled || false,
        filePath: template.preTrainingData?.filePath || "",
        description: template.preTrainingData?.description || "",
      },
    };
  } catch (error) {
    // Fallback to constant on error (try both original and normalized key)
    const normalizedKey = templateKey?.toLowerCase();
    return (
      CHATBOT_TEMPLATES[templateKey] || CHATBOT_TEMPLATES[normalizedKey] || null
    );
  }
};

/**
 * Get all available templates from database
 * @returns {Promise<Array>} Array of template objects with name and description
 */
export const getAllTemplates = async () => {
  try {
    const templates = await ChatbotTemplate.find({ status: "active" })
      .sort({ displayOrder: 1 })
      .select("key name description preTrainingData widget config");

    return templates.map((template) => ({
      id: template.key,
      key: template.key,
      name: template.name,
      description: template.description,
      hasPreTraining: template.preTrainingData?.enabled || false,
      preTrainingDescription: template.preTrainingData?.description || null,
      widget: {
        theme: template.widget?.theme || {},
      },
      config: {
        topK: template.config?.topK || 5,
        chunkSize: template.config?.chunkSize || 1000,
        chunkOverlap: template.config?.chunkOverlap || 200,
      },
    }));
  } catch (error) {
    // Fallback to constant if database query fails
    return Object.entries(CHATBOT_TEMPLATES).map(([key, template]) => ({
      id: key,
      key: key,
      name: template.name,
      description: template.description,
      hasPreTraining: template.preTrainingData?.enabled || false,
      preTrainingDescription: template.preTrainingData?.description || null,
      widget: {
        theme: template.widget?.theme || {},
      },
      config: {
        topK: template.config?.topK || 5,
        chunkSize: template.config?.chunkSize || 1000,
        chunkOverlap: template.config?.chunkOverlap || 200,
      },
    }));
  }
};

/**
 * Apply template to chatbot config
 * @param {string} templateKey - Key of the template (e.g., "customerSupport")
 * @param {Object} customConfig - Custom configuration to override template defaults
 * @returns {Promise<Object>} Merged configuration
 */
export const applyTemplate = async (templateKey, customConfig = {}) => {
  const template = await getTemplate(templateKey);
  if (!template) {
    throw new Error(`Template "${templateKey}" not found`);
  }

  return {
    systemPrompt: customConfig.systemPrompt || template.systemPrompt,
    temperature: customConfig.temperature ?? template.temperature,
    maxTokens: customConfig.maxTokens ?? template.maxTokens,
    topK: customConfig.topK ?? template.config?.topK ?? 5,
    chunkSize: customConfig.chunkSize ?? template.config?.chunkSize ?? 1000,
    chunkOverlap:
      customConfig.chunkOverlap ?? template.config?.chunkOverlap ?? 200,
    widget: {
      theme: customConfig.widget?.theme ||
        template.widget?.theme || {
          primaryColor: "#007bff",
          backgroundColor: "#ffffff",
          position: "bottom-right",
        },
    },
  };
};
