import { generateEmbeddings } from "./embeddings.js";

/**
 * Ollama Embedding Function for ChromaDB
 * This allows ChromaDB to use Ollama embeddings for collections
 */
export class OllamaEmbeddingFunction {
  constructor(model = "nomic-embed-text") {
    this.model = model;
  }

  /**
   * Generate embeddings for texts
   * ChromaDB will call this method when needed
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<number[][]>} Array of embedding vectors
   */
  async generate(texts) {
    try {
      const embeddings = await generateEmbeddings(texts, this.model);
      return embeddings;
    } catch (error) {
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
  }
}

