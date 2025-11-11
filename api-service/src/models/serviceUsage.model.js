import mongoose from "mongoose";

const serviceUsageSchema = new mongoose.Schema(
  {
    // User Reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Service Reference
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },

    // Usage Details
    request: {
      type: {
        type: String,
        required: true,
      },
      prompt: String,
      parameters: mongoose.Schema.Types.Mixed,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },

    // Response Details
    response: {
      success: {
        type: Boolean,
        required: true,
      },
      data: mongoose.Schema.Types.Mixed,
      error: {
        code: String,
        message: String,
      },
      responseTime: Number, // milliseconds
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },

    // Cost Information
    cost: {
      tokens: Number,
      credits: Number,
      amount: Number,
      currency: String,
    },

    // Metadata
    metadata: {
      ipAddress: String,
      userAgent: String,
      sessionId: String,
      referrer: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
serviceUsageSchema.index({ userId: 1 });
serviceUsageSchema.index({ serviceId: 1 });
serviceUsageSchema.index({ createdAt: -1 });
serviceUsageSchema.index({ "request.timestamp": -1 });

// Instance methods
serviceUsageSchema.methods.isSuccessful = function () {
  return this.response.success;
};

serviceUsageSchema.methods.getResponseTime = function () {
  return this.response.responseTime || 0;
};

export default mongoose.model("ServiceUsage", serviceUsageSchema);
