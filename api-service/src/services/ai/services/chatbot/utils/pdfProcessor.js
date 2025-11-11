import fs from "fs/promises";
import logger from "../../../../../utils/logger.js";
import { createRequire } from "module";

// CRITICAL: Setup polyfills for pdf-parse BEFORE requiring it
// pdf-parse requires DOMMatrix, ImageData, Path2D which are browser APIs
// These MUST be set on global scope before pdf-parse module loads

// Define DOMMatrix polyfill
const DOMMatrixPolyfill = class DOMMatrix {
  constructor(init) {
    this.a = 1;
    this.b = 0;
    this.c = 0;
    this.d = 1;
    this.e = 0;
    this.f = 0;
    if (init && typeof init === "string") {
      const values = init.match(/[\d.+-]+/g);
      if (values && values.length >= 6) {
        this.a = parseFloat(values[0]) || 1;
        this.b = parseFloat(values[1]) || 0;
        this.c = parseFloat(values[2]) || 0;
        this.d = parseFloat(values[3]) || 1;
        this.e = parseFloat(values[4]) || 0;
        this.f = parseFloat(values[5]) || 0;
      }
    } else if (init && typeof init === "object") {
      // Support matrix-like object
      this.a = init.a ?? 1;
      this.b = init.b ?? 0;
      this.c = init.c ?? 0;
      this.d = init.d ?? 1;
      this.e = init.e ?? 0;
      this.f = init.f ?? 0;
    }
  }
};

// Set polyfills on all possible global scopes
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = DOMMatrixPolyfill;
}
if (typeof global !== "undefined" && typeof global.DOMMatrix === "undefined") {
  global.DOMMatrix = DOMMatrixPolyfill;
}

if (typeof globalThis.ImageData === "undefined") {
  const ImageDataPolyfill = class ImageData {
    constructor(data, width, height) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  };
  globalThis.ImageData = ImageDataPolyfill;
  if (typeof global !== "undefined") {
    global.ImageData = ImageDataPolyfill;
  }
}

if (typeof globalThis.Path2D === "undefined") {
  const Path2DPolyfill = class Path2D {
    constructor() {}
  };
  globalThis.Path2D = Path2DPolyfill;
  if (typeof global !== "undefined") {
    global.Path2D = Path2DPolyfill;
  }
}

// Now safely require pdf-parse (it will use the polyfills we just set)
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

/**
 * Extract text from PDF file
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<{text: string, pages: number, metadata: object}>}
 */
export const extractTextFromPDF = async (filePath) => {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);

    return {
      text: data.text,
      pages: data.numpages,
      metadata: {
        info: data.info,
        metadata: data.metadata,
        version: data.version,
      },
    };
  } catch (error) {
    logger.error("Error extracting text from PDF:", error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
};

/**
 * Extract text from text file
 * @param {string} filePath - Path to text file
 * @returns {Promise<string>}
 */
export const extractTextFromFile = async (filePath) => {
  try {
    const text = await fs.readFile(filePath, "utf-8");
    return text;
  } catch (error) {
    logger.error("Error reading text file:", error);
    throw new Error(`Failed to read text file: ${error.message}`);
  }
};

/**
 * Extract text from uploaded file (supports PDF and TXT)
 * @param {string} filePath - Path to file
 * @param {string} mimetype - MIME type of file
 * @returns {Promise<{text: string, pages?: number, metadata?: object}>}
 */
export const extractTextFromUpload = async (filePath, mimetype) => {
  if (mimetype === "application/pdf") {
    return await extractTextFromPDF(filePath);
  } else if (mimetype === "text/plain" || mimetype === "text/markdown") {
    const text = await extractTextFromFile(filePath);
    return { text, pages: 1 };
  } else {
    throw new Error(`Unsupported file type: ${mimetype}`);
  }
};
