import ChatbotTemplate from "../../../../../models/chatbotTemplate.model.js";
import { CHATBOT_TEMPLATES } from "./templates.js";
import logger from "../../../../../utils/logger.js";

/**
 * Initialize chatbot templates in database from CHATBOT_TEMPLATES constant
 */
export const initializeChatbotTemplates = async () => {
  try {
    logger.info("🔄 Initializing chatbot templates...");

    // Check if templates already exist
    const existingTemplates = await ChatbotTemplate.countDocuments();
    if (existingTemplates > 0) {
      logger.info("✅ Chatbot templates already exist in database");
      // Update existing templates if structure changed
      await updateExistingTemplates();
      return;
    }

    // Convert CHATBOT_TEMPLATES constant to database format
    const templatesToInsert = Object.entries(CHATBOT_TEMPLATES).map(
      ([key, template], index) => ({
        key: key.toLowerCase(), // Ensure lowercase for consistency
        name: template.name,
        description: template.description,
        systemPrompt: template.systemPrompt,
        temperature: template.temperature,
        maxTokens: template.maxTokens,
        config: {
          topK: template.config.topK,
          chunkSize: template.config.chunkSize,
          chunkOverlap: template.config.chunkOverlap,
        },
        widget: {
          theme: template.widget.theme,
        },
        preTrainingData: {
          enabled: template.preTrainingData?.enabled || false,
          filePath: template.preTrainingData?.filePath || "",
          description: template.preTrainingData?.description || "",
        },
        status: "active",
        displayOrder: index + 1,
        metadata: {
          isDefault: true,
          category: "default",
          tags: [],
        },
      })
    );

    // Insert all templates
    await ChatbotTemplate.insertMany(templatesToInsert);

    logger.info(
      `✅ Chatbot templates initialized successfully: ${templatesToInsert.length} templates`
    );
    templatesToInsert.forEach((template) => {
      logger.info(`   - ${template.name} (${template.key})`);
    });
  } catch (error) {
    logger.error("❌ Error initializing chatbot templates:", error);
    throw error;
  }
};

/**
 * Update existing templates if structure changed
 */
const updateExistingTemplates = async () => {
  try {
    const templates = await ChatbotTemplate.find({
      "metadata.isDefault": true,
    });

    for (const template of templates) {
      // Try both original key and lowercase key
      const templateData =
        CHATBOT_TEMPLATES[template.key] ||
        CHATBOT_TEMPLATES[template.key.toLowerCase()];
      if (templateData) {
        // Update template with latest data from constant
        await ChatbotTemplate.updateOne(
          { key: template.key },
          {
            $set: {
              name: templateData.name,
              description: templateData.description,
              systemPrompt: templateData.systemPrompt,
              temperature: templateData.temperature,
              maxTokens: templateData.maxTokens,
              "config.topK": templateData.config.topK,
              "config.chunkSize": templateData.config.chunkSize,
              "config.chunkOverlap": templateData.config.chunkOverlap,
              "widget.theme": templateData.widget.theme,
              "preTrainingData.enabled":
                templateData.preTrainingData?.enabled || false,
              "preTrainingData.filePath":
                templateData.preTrainingData?.filePath || "",
              "preTrainingData.description":
                templateData.preTrainingData?.description || "",
            },
          }
        );
      }
    }

    logger.info("✅ Existing templates updated");
  } catch (error) {
    logger.warn("⚠️ Error updating existing templates:", error);
    // Don't throw - this is not critical
  }
};
