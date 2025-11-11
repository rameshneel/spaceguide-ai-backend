import mongoose from "mongoose";

const chatbotSchema = new mongoose.Schema(
  {
    // User Reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Chatbot Information
    name: {
      type: String,
      required: [true, "Chatbot name is required"],
      trim: true,
      maxlength: [100, "Chatbot name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },

    // Vector Database Configuration
    collectionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    collectionName: {
      type: String,
      required: true,
    },

    // Status
    status: {
      type: String,
      enum: ["active", "training", "inactive", "error"],
      default: "inactive",
    },

    // Training Data
    trainingData: {
      totalDocuments: {
        type: Number,
        default: 0,
      },
      totalChunks: {
        type: Number,
        default: 0,
      },
      totalSize: {
        type: Number,
        default: 0,
        description: "Total size of all training files in bytes",
      },
      lastTrainedAt: Date,
      trainingStatus: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending",
      },
      fileTypes: [String], // ["pdf", "txt"]
    },

    // Configuration
    config: {
      systemPrompt: {
        type: String,
        default:
          "You are a helpful AI assistant. Answer questions based on the provided context.",
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
      topK: {
        type: Number,
        default: 5,
        min: 1,
        max: 20,
        description: "Number of top similar chunks to retrieve",
      },
      chunkSize: {
        type: Number,
        default: 1000,
        min: 100,
        max: 5000,
        description: "Character size for text chunking",
      },
      chunkOverlap: {
        type: Number,
        default: 200,
        min: 0,
        max: 1000,
        description: "Character overlap between chunks",
      },
    },

    // Widget Configuration
    widget: {
      enabled: {
        type: Boolean,
        default: true,
      },
      apiKey: {
        type: String,
        required: true,
        unique: true,
      },
      theme: {
        primaryColor: {
          type: String,
          default: "#007bff",
        },
        backgroundColor: {
          type: String,
          default: "#ffffff",
        },
        position: {
          type: String,
          enum: ["bottom-right", "bottom-left", "top-right", "top-left"],
          default: "bottom-right",
        },
      },
      widgetUrl: {
        type: String,
        default: "",
      },
    },

    // Statistics
    statistics: {
      totalQueries: {
        type: Number,
        default: 0,
      },
      successfulQueries: {
        type: Number,
        default: 0,
      },
      failedQueries: {
        type: Number,
        default: 0,
      },
      averageResponseTime: {
        type: Number,
        default: 0,
      },
      lastUsedAt: Date,
    },

    // Metadata
    metadata: {
      model: {
        type: String,
        default: "gpt-3.5-turbo",
      },
      embeddingModel: {
        type: String,
        default: "text-embedding-3-small",
      },
      provider: {
        type: String,
        default: "openai",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
chatbotSchema.index({ userId: 1, createdAt: -1 });
chatbotSchema.index({ status: 1 });
chatbotSchema.index({ "widget.apiKey": 1 });

// Instance methods
chatbotSchema.methods.incrementQuery = function (
  success = true,
  responseTime = 0
) {
  this.statistics.totalQueries += 1;
  if (success) {
    this.statistics.successfulQueries += 1;
  } else {
    this.statistics.failedQueries += 1;
  }

  // Update average response time
  const total = this.statistics.successfulQueries;
  if (total > 0) {
    this.statistics.averageResponseTime =
      (this.statistics.averageResponseTime * (total - 1) + responseTime) /
      total;
  }

  this.statistics.lastUsedAt = new Date();
  return this.save();
};

chatbotSchema.methods.updateTrainingStatus = function (
  status,
  documentCount = 0,
  chunkCount = 0
) {
  // Update main status based on training status
  if (status === "completed") {
    this.status = "active";
  } else if (status === "processing") {
    this.status = "training";
  } else if (status === "failed") {
    // If training fails, keep chatbot active (it can still be used without pre-training data)
    // Only set to active if it was in training state, otherwise keep current status
    if (this.status === "training") {
      this.status = "active";
    }
  }

  this.trainingData.trainingStatus = status;

  if (status === "completed") {
    this.trainingData.totalDocuments = documentCount;
    this.trainingData.totalChunks = chunkCount;
    this.trainingData.lastTrainedAt = new Date();
  }

  return this.save();
};

export default mongoose.model("Chatbot", chatbotSchema);
