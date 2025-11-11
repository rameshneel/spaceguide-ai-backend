import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    // User Reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },

    // Plan Reference
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: [true, "Plan ID is required"],
    },

    // Legacy plan field (for backward compatibility)
    plan: {
      type: String,
      enum: ["free", "basic", "pro", "enterprise"],
      default: "free",
    },

    status: {
      type: String,
      enum: ["active", "inactive", "cancelled", "expired", "pending"],
      default: "pending",
    },

    // Stripe Integration
    stripeSubscriptionId: String,
    stripeCustomerId: String,
    stripePriceId: String,

    // Billing
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },

    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },

    // Pricing
    amount: Number,
    currency: {
      type: String,
      default: "USD",
    },

    // Plan-specific Limits (aligned with SubscriptionPlan)
    limits: {
      aiTextWriter: {
        wordsPerDay: Number,
        requestsPerDay: Number,
      },
      aiImageGenerator: {
        imagesPerDay: Number,
        requestsPerDay: Number,
      },
      aiSearch: {
        searchesPerDay: Number,
        requestsPerDay: Number,
      },
      aiChatbot: {
        chatbotsPerAccount: Number,
        messagesPerDay: Number,
      },
      // Legacy fields for backward compatibility
      wordLimit: Number,
      imageLimit: Number,
      minuteLimit: Number,
      characterLimit: Number,
      maxImageResolution: String,
      pageLimit: Number,
      chatbotLimit: Number,
      voiceCloneLimit: Number,
    },

    // Features (aligned with SubscriptionPlan)
    features: {
      aiTextWriter: {
        enabled: Boolean,
      },
      aiImageGenerator: {
        enabled: Boolean,
      },
      aiSearch: {
        enabled: Boolean,
      },
      aiChatbot: {
        enabled: Boolean,
      },
      prioritySupport: Boolean,
      apiAccess: Boolean,
      customBranding: Boolean,
      analytics: Boolean,
      // Legacy fields for backward compatibility
      aiTemplates: Boolean,
      languages: Number,
      aiArticleWriter: Boolean,
      completeArticleRewriter: Boolean,
      spaceguideaiBot: Boolean,
      priorityAccess: Boolean,
      supportLevel: {
        type: String,
        enum: ["basic", "premium"],
        default: "basic",
      },
    },

    // Usage Tracking
    usage: {
      wordsUsed: { type: Number, default: 0 },
      imagesUsed: { type: Number, default: 0 },
      minutesUsed: { type: Number, default: 0 },
      charactersUsed: { type: Number, default: 0 },
      pagesUsed: { type: Number, default: 0 },
      chatbotsUsed: { type: Number, default: 0 },
      voiceClonesUsed: { type: Number, default: 0 },
      lastResetDate: Date,
    },

    // Admin Fields
    adminNotes: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ plan: 1 });

// Instance methods
subscriptionSchema.methods.isActive = function () {
  return this.status === "active" && new Date() < this.currentPeriodEnd;
};

subscriptionSchema.methods.getRemainingWords = function () {
  return this.limits.wordLimit - this.usage.wordsUsed;
};

subscriptionSchema.methods.getRemainingImages = function () {
  return this.limits.imageLimit - this.usage.imagesUsed;
};

subscriptionSchema.methods.getRemainingMinutes = function () {
  return this.limits.minuteLimit - this.usage.minutesUsed;
};

// Static methods for plan configuration
subscriptionSchema.statics.getPlanConfig = function (plan) {
  const plans = {
    starter: {
      amount: 24.99,
      limits: {
        wordLimit: 50000,
        imageLimit: 200,
        minuteLimit: 1000,
        characterLimit: 200000,
        maxImageResolution: "256x256",
        pageLimit: 10,
        chatbotLimit: 10,
        voiceCloneLimit: 10,
      },
      features: {
        aiTemplates: true,
        languages: 10,
        aiArticleWriter: true,
        completeArticleRewriter: false,
        spaceguideaiBot: false,
        priorityAccess: true,
        supportLevel: "basic",
      },
    },
    premium: {
      amount: 49.99,
      limits: {
        wordLimit: 100000,
        imageLimit: 500,
        minuteLimit: 5000,
        characterLimit: 400000,
        maxImageResolution: "512x512",
        pageLimit: 20,
        chatbotLimit: 20,
        voiceCloneLimit: 20,
      },
      features: {
        aiTemplates: true,
        languages: 10,
        aiArticleWriter: true,
        completeArticleRewriter: true,
        spaceguideaiBot: false,
        priorityAccess: true,
        supportLevel: "premium",
      },
    },
    platinum: {
      amount: 199.99,
      limits: {
        wordLimit: 200000,
        imageLimit: 1000,
        minuteLimit: 10000,
        characterLimit: 500000,
        maxImageResolution: "1024x1024",
        pageLimit: 30,
        chatbotLimit: 30,
        voiceCloneLimit: 30,
      },
      features: {
        aiTemplates: true,
        languages: 25,
        aiArticleWriter: true,
        completeArticleRewriter: true,
        spaceguideaiBot: true,
        priorityAccess: true,
        supportLevel: "premium",
      },
    },
  };
  return plans[plan];
};

export default mongoose.model("Subscription", subscriptionSchema);
