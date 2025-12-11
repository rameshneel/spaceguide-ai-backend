import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    // Chatbot Reference
    chatbotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chatbot",
      required: true,
    },

    // User Reference (for tracking)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Session Information
    sessionId: {
      type: String,
      required: true,
    },

    // Messages
    messages: [
      {
        role: {
          type: String,
          enum: ["user", "assistant", "system"],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        metadata: {
          tokens: Number,
          responseTime: Number,
          sources: [String], // Document IDs used for context
        },
      },
    ],

    // Statistics
    messageCount: {
      type: Number,
      default: 0,
    },
    totalTokens: {
      type: Number,
      default: 0,
    },

    // Status
    status: {
      type: String,
      enum: ["active", "ended"],
      default: "active",
    },

    // Metadata
    metadata: {
      ipAddress: String,
      userAgent: String,
      referrer: String,
      startedAt: {
        type: Date,
        default: Date.now,
      },
      endedAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
conversationSchema.index({ chatbotId: 1, createdAt: -1 });
conversationSchema.index({ userId: 1, createdAt: -1 });
conversationSchema.index({ sessionId: 1 });

// Instance methods
conversationSchema.methods.addMessage = function (
  role,
  content,
  metadata = {}
) {
  this.messages.push({
    role,
    content,
    timestamp: new Date(),
    metadata,
  });
  this.messageCount += 1;
  if (metadata.tokens) {
    this.totalTokens += metadata.tokens;
  }
  return this.save();
};

conversationSchema.methods.endConversation = function () {
  this.status = "ended";
  this.metadata.endedAt = new Date();
  return this.save();
};

export default mongoose.model("Conversation", conversationSchema);
