import mongoose from "mongoose";

const chatbotTemplateSchema = new mongoose.Schema(
  {
    // Template identifier (unique key)
    key: {
      type: String,
      required: [true, "Template key is required"],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    // Display Information
    name: {
      type: String,
      required: [true, "Template name is required"],
      trim: true,
      maxlength: [100, "Template name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Template description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    // AI Configuration
    systemPrompt: {
      type: String,
      required: [true, "System prompt is required"],
      maxlength: [2000, "System prompt cannot exceed 2000 characters"],
    },
    temperature: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 2,
    },
    maxTokens: {
      type: Number,
      default: 500,
      min: 50,
      max: 4000,
    },

    // Vector Search Configuration
    config: {
      topK: {
        type: Number,
        default: 5,
        min: 1,
        max: 20,
      },
      chunkSize: {
        type: Number,
        default: 1000,
        min: 100,
        max: 5000,
      },
      chunkOverlap: {
        type: Number,
        default: 200,
        min: 0,
        max: 1000,
      },
    },

    // Widget Theme Configuration
    widget: {
      theme: {
        primaryColor: {
          type: String,
          default: "#007bff",
          match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color"],
        },
        backgroundColor: {
          type: String,
          default: "#ffffff",
          match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color"],
        },
        position: {
          type: String,
          enum: ["bottom-right", "bottom-left", "top-right", "top-left"],
          default: "bottom-right",
        },
      },
    },

    // Pre-training Data Configuration
    preTrainingData: {
      enabled: {
        type: Boolean,
        default: false,
      },
      filePath: {
        type: String,
        trim: true,
        default: "",
      },
      description: {
        type: String,
        trim: true,
        default: "",
      },
    },

    // Status
    status: {
      type: String,
      enum: ["active", "inactive", "draft"],
      default: "active",
    },

    // Display Order (for sorting)
    displayOrder: {
      type: Number,
      default: 0,
    },

    // Metadata
    metadata: {
      isDefault: {
        type: Boolean,
        default: false,
      },
      category: {
        type: String,
        trim: true,
        default: "general",
      },
      tags: [String],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
chatbotTemplateSchema.index({ key: 1 }, { unique: true });
chatbotTemplateSchema.index({ status: 1 });
chatbotTemplateSchema.index({ displayOrder: 1 });

// Methods
chatbotTemplateSchema.methods.toJSON = function () {
  const obj = this.toObject();
  return obj;
};

const ChatbotTemplate = mongoose.model(
  "ChatbotTemplate",
  chatbotTemplateSchema
);

export default ChatbotTemplate;
