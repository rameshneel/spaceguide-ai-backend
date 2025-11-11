import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allowed file types for chatbot training
const allowedFileTypes = [".pdf", ".txt", ".md"];
const allowedMimeTypes = ["application/pdf", "text/plain", "text/markdown"];

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(
  __dirname,
  "..",
  "..",
  "uploads",
  "chatbot-training"
);
fs.mkdir(uploadsDir, { recursive: true }).catch((err) => {
  logger.warn("Failed to create uploads directory:", err);
});

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const randomFilename = `training-${uniqueSuffix}${ext}`;
    cb(null, randomFilename);
  },
});

const limits = { fileSize: 10 * 1024 * 1024 }; // 10MB limit for PDFs

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype;

  if (allowedFileTypes.includes(ext) && allowedMimeTypes.includes(mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Only PDF and text files are allowed! Received: ${ext} (${mimetype})`
      ),
      false
    );
  }
};

export const uploadTrainingFile = multer({
  storage,
  limits,
  fileFilter,
});

// Single file upload
export const uploadSingleTrainingFile = uploadTrainingFile.single("file");

// Multiple files upload
export const uploadMultipleTrainingFiles = uploadTrainingFile.array("files", 5);
