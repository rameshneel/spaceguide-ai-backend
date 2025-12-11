/**
 * PDF Parse Polyfill
 * Sets up required polyfills for pdf-parse library in Node.js environment
 * Must be imported BEFORE any module that uses pdf-parse
 *
 * This runs synchronously at module load time to ensure polyfills are available
 * before pdf-parse tries to use them.
 */

// Define DOMMatrix polyfill class
const DOMMatrixPolyfill = class DOMMatrix {
  constructor(init) {
    this.a = 1;
    this.b = 0;
    this.c = 0;
    this.d = 1;
    this.e = 0;
    this.f = 0;
    if (init && typeof init === "string") {
      // Parse matrix string if needed
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

// Set DOMMatrix on all global scopes
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = DOMMatrixPolyfill;
}
if (typeof global !== "undefined" && typeof global.DOMMatrix === "undefined") {
  global.DOMMatrix = DOMMatrixPolyfill;
}

// Define ImageData polyfill
const ImageDataPolyfill = class ImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};

// Set ImageData on all global scopes
if (typeof globalThis.ImageData === "undefined") {
  globalThis.ImageData = ImageDataPolyfill;
  if (typeof global !== "undefined") {
    global.ImageData = ImageDataPolyfill;
  }
}

// Define Path2D polyfill
const Path2DPolyfill = class Path2D {
  constructor() {
    // Minimal implementation
  }
};

// Set Path2D on all global scopes
if (typeof globalThis.Path2D === "undefined") {
  globalThis.Path2D = Path2DPolyfill;
  if (typeof global !== "undefined") {
    global.Path2D = Path2DPolyfill;
  }
}

// Export nothing - this module only has side effects
