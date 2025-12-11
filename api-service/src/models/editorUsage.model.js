import mongoose from "mongoose";

const editorUsageSchema = new mongoose.Schema(
  {
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD for easy per-day grouping
      required: true,
    },
    runsToday: {
      type: Number,
      default: 0,
    },
    aiCallsToday: {
      type: Number,
      default: 0,
    },
    storageUsedBytes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

editorUsageSchema.index({ ownerUserId: 1, date: 1 }, { unique: true });

export default mongoose.model("EditorUsage", editorUsageSchema);
