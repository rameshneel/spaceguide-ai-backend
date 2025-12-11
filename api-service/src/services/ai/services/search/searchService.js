import { ChromaClient } from "chromadb";
import { generateEmbedding } from "../chatbot/utils/embeddings.js";
import { OpenAIEmbeddingFunction } from "../chatbot/utils/openaiEmbeddingFunction.js";
import { safeLogger as logger } from "../../../../utils/logger.js";

// Lazy-loaded ChromaDB client
let chromaClient = null;

const getChromaClient = () => {
  if (!chromaClient) {
    const chromaUrl = process.env.CHROMADB_URL || "http://localhost:8000";
    try {
      const url = new URL(chromaUrl);
      chromaClient = new ChromaClient({
        host: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        ssl: url.protocol === "https:",
      });
    } catch (error) {
      logger.warn(
        "Using deprecated ChromaDB path format. Please update CHROMADB_URL to full URL format."
      );
      chromaClient = new ChromaClient({
        path: chromaUrl,
      });
    }
  }
  return chromaClient;
};

// Collection name for AI Search
const SEARCH_COLLECTION_NAME = "ai_search_documents";

/**
 * Initialize or get the search collection
 */
const getSearchCollection = async () => {
  const chroma = getChromaClient();
  try {
    // Try to get existing collection
    const collection = await chroma.getCollection({
      name: SEARCH_COLLECTION_NAME,
      embeddingFunction: new OpenAIEmbeddingFunction("text-embedding-3-small"),
    });
    return collection;
  } catch (error) {
    // Collection doesn't exist, create it
    logger.info(`Creating new ChromaDB collection: ${SEARCH_COLLECTION_NAME}`);
    const collection = await chroma.createCollection({
      name: SEARCH_COLLECTION_NAME,
      embeddingFunction: new OpenAIEmbeddingFunction("text-embedding-3-small"),
      metadata: {
        description: "AI Search documents collection",
        created_at: new Date().toISOString(),
      },
    });
    return collection;
  }
};

/**
 * Index a document for search
 * @param {string} content - Document content
 * @param {Object} metadata - Document metadata (title, url, source, etc.)
 * @returns {Promise<string>} Document ID
 */
export const indexDocument = async (content, metadata = {}) => {
  try {
    const collection = await getSearchCollection();
    
    // Generate unique ID for the document
    const docId = metadata.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Prepare metadata
    const docMetadata = {
      ...metadata,
      indexed_at: new Date().toISOString(),
      content_length: content.length,
    };

    // Add document to collection
    await collection.add({
      ids: [docId],
      documents: [content],
      metadatas: [docMetadata],
    });

    logger.info(`Indexed document: ${docId}`);
    return docId;
  } catch (error) {
    logger.error("Error indexing document:", error);
    throw new Error(`Failed to index document: ${error.message}`);
  }
};

/**
 * Index multiple documents in batch
 * @param {Array<{content: string, metadata?: Object}>} documents - Array of documents
 * @returns {Promise<string[]>} Array of document IDs
 */
export const indexDocuments = async (documents) => {
  try {
    const collection = await getSearchCollection();
    
    const ids = [];
    const contents = [];
    const metadatas = [];

    documents.forEach((doc, index) => {
      const docId = doc.metadata?.id || `doc_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
      ids.push(docId);
      contents.push(doc.content);
      metadatas.push({
        ...doc.metadata,
        indexed_at: new Date().toISOString(),
        content_length: doc.content.length,
      });
    });

    await collection.add({
      ids,
      documents: contents,
      metadatas,
    });

    logger.info(`Indexed ${documents.length} documents`);
    return ids;
  } catch (error) {
    logger.error("Error indexing documents:", error);
    throw new Error(`Failed to index documents: ${error.message}`);
  }
};

/**
 * Perform semantic search
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results
 * @param {Object} filter - Optional metadata filter
 * @returns {Promise<Array>} Search results
 */
export const semanticSearch = async (query, limit = 10, filter = null) => {
  try {
    const collection = await getSearchCollection();
    
    // Perform similarity search
    const results = await collection.query({
      queryTexts: [query],
      nResults: limit,
      where: filter || undefined,
    });

    // Format results
    const formattedResults = [];
    if (results.ids && results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        formattedResults.push({
          id: results.ids[0][i],
          content: results.documents[0][i],
          metadata: results.metadatas[0][i] || {},
          distance: results.distances?.[0]?.[i] || null,
          score: results.distances?.[0]?.[i] 
            ? 1 - results.distances[0][i] // Convert distance to similarity score
            : null,
        });
      }
    }

    logger.info(`Search query "${query}" returned ${formattedResults.length} results`);
    return formattedResults;
  } catch (error) {
    logger.error("Error performing semantic search:", error);
    throw new Error(`Search failed: ${error.message}`);
  }
};

/**
 * Delete a document from the index
 * @param {string} docId - Document ID
 */
export const deleteDocument = async (docId) => {
  try {
    const collection = await getSearchCollection();
    await collection.delete({ ids: [docId] });
    logger.info(`Deleted document: ${docId}`);
  } catch (error) {
    logger.error("Error deleting document:", error);
    throw new Error(`Failed to delete document: ${error.message}`);
  }
};

/**
 * Get collection statistics
 */
export const getCollectionStats = async () => {
  try {
    const collection = await getSearchCollection();
    const count = await collection.count();
    return {
      collectionName: SEARCH_COLLECTION_NAME,
      documentCount: count,
    };
  } catch (error) {
    logger.error("Error getting collection stats:", error);
    throw new Error(`Failed to get stats: ${error.message}`);
  }
};
