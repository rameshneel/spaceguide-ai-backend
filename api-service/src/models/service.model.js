import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    // Service Information
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    type: {
      type: String,
      enum: [
        "ai_text_writer",
        "ai_image_generator",
        "ai_chatbot_builder",
        "ai_search",
        "text",
        "image",
        "chatbot",
        "search",
        "powerpoint",
        "crm",
        "payroll",
        "code-editor",
        "uber",
      ],
      required: true,
    },

    // API Configuration
    apiConfig: {
      provider: {
        type: String,
        required: true,
      },
      apiKey: {
        type: String,
        required: true,
      },
      baseUrl: {
        type: String,
        required: true,
      },
      endpoints: {
        generate: String,
        status: String,
        webhook: String,
      },
    },

    // Service Status
    status: {
      type: String,
      enum: ["active", "inactive", "maintenance", "error"],
      default: "active",
    },

    // Usage Limits
    limits: {
      dailyLimit: {
        type: Number,
        default: 100,
      },
      monthlyLimit: {
        type: Number,
        default: 1000,
      },
      rateLimit: {
        type: Number,
        default: 10, // requests per minute
      },
    },

    // Pricing
    pricing: {
      free: {
        calls: Number,
        features: [String],
      },
      premium: {
        calls: Number,
        features: [String],
        price: Number,
      },
      enterprise: {
        calls: Number,
        features: [String],
        price: Number,
      },
    },

    // Statistics
    stats: {
      totalCalls: {
        type: Number,
        default: 0,
      },
      successfulCalls: {
        type: Number,
        default: 0,
      },
      failedCalls: {
        type: Number,
        default: 0,
      },
      lastUsed: Date,
      averageResponseTime: Number,
    },

    // Configuration
    config: {
      timeout: {
        type: Number,
        default: 30000, // 30 seconds
      },
      retryAttempts: {
        type: Number,
        default: 3,
      },
      cacheEnabled: {
        type: Boolean,
        default: true,
      },
      cacheTTL: {
        type: Number,
        default: 3600, // 1 hour
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
serviceSchema.index({ type: 1 });
serviceSchema.index({ status: 1 });
serviceSchema.index({ createdAt: -1 });

// Instance methods
serviceSchema.methods.isWithinLimits = function (usageCount) {
  return usageCount < this.limits.dailyLimit;
};

serviceSchema.methods.getSuccessRate = function () {
  if (this.stats.totalCalls === 0) return 0;
  return (this.stats.successfulCalls / this.stats.totalCalls) * 100;
};

export default mongoose.model("Service", serviceSchema);
