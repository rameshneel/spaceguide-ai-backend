import mongoose from "mongoose";

const valuationJackalSchema = new mongoose.Schema(
  {
    // User Reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Company Information
    company: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      industry: String,
      size: {
        type: String,
        enum: ["startup", "small", "medium", "large", "enterprise"],
      },
      location: String,
      website: String,
    },

    // Financial Data
    financials: {
      revenue: Number,
      profit: Number,
      assets: Number,
      liabilities: Number,
      equity: Number,
      cashFlow: Number,
      growthRate: Number,
    },

    // Valuation Results
    valuation: {
      method: {
        type: String,
        enum: ["dcf", "comparable", "asset-based", "market"],
      },
      value: Number,
      range: {
        low: Number,
        high: Number,
      },
      confidence: {
        type: Number,
        min: 0,
        max: 100,
      },
      assumptions: [String],
      risks: [String],
    },

    // Analysis Details
    analysis: {
      strengths: [String],
      weaknesses: [String],
      opportunities: [String],
      threats: [String],
      recommendations: [String],
    },

    // Status
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
valuationJackalSchema.index({ userId: 1 });
valuationJackalSchema.index({ status: 1 });
valuationJackalSchema.index({ createdAt: -1 });

// Instance methods
valuationJackalSchema.methods.isCompleted = function () {
  return this.status === "completed";
};

valuationJackalSchema.methods.getValuationRange = function () {
  return `${this.valuation.range.low} - ${this.valuation.range.high}`;
};

export default mongoose.model("ValuationJackal", valuationJackalSchema);
