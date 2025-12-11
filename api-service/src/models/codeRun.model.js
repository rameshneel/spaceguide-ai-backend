import mongoose from "mongoose";

const codeRunSchema = new mongoose.Schema(
  {
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    language: {
      type: String,
      trim: true,
      default: "plaintext",
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    success: {
      type: Boolean,
      default: false,
    },
    stdout: {
      type: String,
      default: "",
    },
    stderr: {
      type: String,
      default: "",
    },
    exitCode: {
      type: Number,
      default: null,
    },
    codeSizeBytes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

codeRunSchema.index({ createdAt: -1 });

export default mongoose.model("CodeRun", codeRunSchema);
