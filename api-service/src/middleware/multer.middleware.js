import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedFileTypes = [".jpg", ".jpeg", ".png"];

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    logger.info(`Multer upload directory: ${process.cwd()}`);
    cb(null, path.join(__dirname, "..", "..", "public", "images"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Math.round(Math.random() * 1e9);
    const randomFilename = uniqueSuffix + "-" + file.originalname;
    cb(null, randomFilename);
  },
});

const limits = { fileSize: 1024 * 1000 }; // 1MB limit

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedFileTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

export const upload = multer({
  storage,
  limits,
  fileFilter,
});
