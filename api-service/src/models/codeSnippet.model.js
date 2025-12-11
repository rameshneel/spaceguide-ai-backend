import mongoose from "mongoose";

const codeSnippetSchema = new mongoose.Schema(
  {
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    language: {
      type: String,
      trim: true,
      default: "plaintext",
    },
    code: {
      type: String,
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 0,
    },
    versions: [
      {
        code: String,
        sizeBytes: Number,
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["active", "deleted"],
      default: "active",
    },
    deletedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

codeSnippetSchema.index({ expiresAt: 1 }, { sparse: true });
codeSnippetSchema.index({ ownerUserId: 1, status: 1 });

export default mongoose.model("CodeSnippet", codeSnippetSchema);
