import { generateEmbeddings } from "./embeddings.js";

/**
 * Custom OpenAI Embedding Function for ChromaDB
 * This is a simple object that implements the embedding function interface
 * Since we provide embeddings manually in add(), this is mainly for collection creation
 */
export class OpenAIEmbeddingFunction {
  constructor(model = "text-embedding-3-small") {
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
