/**
 * Constants for Chatbot Service
 */

// Batch processing
export const CHUNK_BATCH_SIZE = 100;
export const MAX_EMBEDDING_BATCH_SIZE = 100;

// Context and limits
export const MAX_CONTEXT_LENGTH = 8000; // characters
export const MAX_TEXT_LENGTH = 1000000; // 1MB text
export const MAX_DOCUMENT_LENGTH = 10000; // characters per document
export const MAX_DELETE_BATCH_SIZE = 100;

// API timeouts (milliseconds)
export const EMBEDDING_TIMEOUT_MS = 20000; // 20 seconds
export const CHAT_TIMEOUT_MS = 30000; // 30 seconds
export const VECTOR_QUERY_TIMEOUT_MS = 10000; // 10 seconds

// Pagination defaults
export const DEFAULT_PAGE_LIMIT = 50;
export const DEFAULT_PAGE_OFFSET = 0;
export const MAX_PAGE_LIMIT = 200;

// Model mappings
export const OLLAMA_EMBEDDING_MODEL_MAP = {
  "text-embedding-3-small": "nomic-embed-text",
  "text-embedding-ada-002": "nomic-embed-text",
};

export const OLLAMA_CHAT_MODEL_MAP = {
  "gpt-3.5-turbo": "tinyllama",
  "gpt-4": "tinyllama",
  "gpt-4-turbo": "tinyllama",
};

export const DEFAULT_OLLAMA_EMBEDDING_MODEL = "nomic-embed-text";
export const DEFAULT_OLLAMA_CHAT_MODEL = "tinyllama";

// Embedding model dimensions mapping
// Maps OpenAI model names to their expected dimensions in sentence-transformers
export const EMBEDDING_MODEL_DIMENSIONS = {
  // OpenAI models -> sentence-transformers models with dimensions
  "text-embedding-3-small": 384, // maps to all-MiniLM-L6-v2
  "text-embedding-3-large": 768, // maps to all-mpnet-base-v2
  "text-embedding-ada-002": 384, // maps to all-MiniLM-L6-v2
  "text-embedding": 384, // fallback, maps to all-MiniLM-L6-v2
};

// Model fallback mapping for dimension mismatches
// If collection expects 768 dims, use text-embedding-3-large
// If collection expects 384 dims, use text-embedding-3-small
export const DIMENSION_TO_MODEL_MAP = {
  384: "text-embedding-3-small",
  768: "text-embedding-3-large",
};
