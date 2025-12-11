import { ChromaClient } from "chromadb";
import OpenAI from "openai";
import Chatbot from "../../../../models/chatbot.model.js";
import Conversation from "../../../../models/conversation.model.js";
import { chunkText } from "./utils/textChunker.js";
import { extractTextFromUpload } from "./utils/pdfProcessor.js";
import { extractTextFromFile } from "./utils/pdfProcessor.js";
import { generateEmbeddings } from "./utils/embeddings.js";
import {
  CHUNK_BATCH_SIZE,
  MAX_CONTEXT_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_DOCUMENT_LENGTH,
  MAX_DELETE_BATCH_SIZE,
  EMBEDDING_TIMEOUT_MS,
  CHAT_TIMEOUT_MS,
  VECTOR_QUERY_TIMEOUT_MS,
  DEFAULT_PAGE_LIMIT,
  DEFAULT_PAGE_OFFSET,
  OLLAMA_EMBEDDING_MODEL_MAP,
  OLLAMA_CHAT_MODEL_MAP,
  DEFAULT_OLLAMA_EMBEDDING_MODEL,
  DEFAULT_OLLAMA_CHAT_MODEL,
  DIMENSION_TO_MODEL_MAP,
} from "./utils/constants.js";
import { OpenAIEmbeddingFunction } from "./utils/openaiEmbeddingFunction.js";
import { OllamaEmbeddingFunction } from "./utils/ollamaEmbeddingFunction.js";
import { getOllamaChatCompletion } from "./utils/ollamaClient.js";
import {
  applyTemplate,
  getAllTemplates,
  getTemplate,
} from "./utils/templates.js";
import { safeLogger as logger } from "../../../../utils/logger.js";
import {
  sanitizeModelId,
  sanitizeModelMetadata,
} from "../../../../utils/modelSanitizer.js";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy-loaded clients
let chromaClient = null;
let openaiClient = null;

const getChromaClient = () => {
  if (!chromaClient) {
    const chromaUrl = process.env.CHROMADB_URL || "http://localhost:8000";
    try {
      // Parse URL to extract host and port
      const url = new URL(chromaUrl);
      chromaClient = new ChromaClient({
        host: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        ssl: url.protocol === "https:",
      });
    } catch (error) {
      // Fallback to old format if URL parsing fails
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

/**
 * Get all ChromaDB collections
 */
export const getAllChromaCollections = async () => {
  try {
    const chroma = getChromaClient();
    const collections = await chroma.listCollections();

    const collectionsWithDetails = await Promise.all(
      collections.map(async (collection) => {
        try {
          const count = await collection.count();
          return {
            name: collection.name,
            id: collection.id,
            metadata: collection.metadata || {},
            count: count,
          };
        } catch (error) {
          logger.warn(
            `Error getting details for collection ${collection.name}:`,
            error
          );
          return {
            name: collection.name,
            id: collection.id,
            metadata: collection.metadata || {},
            count: null,
            error: error.message,
          };
        }
      })
    );

    return collectionsWithDetails;
  } catch (error) {
    logger.error("Error listing ChromaDB collections:", error);
    throw new Error(`Failed to list collections: ${error.message}`);
  }
};

/**
 * Get specific ChromaDB collection details
 */
export const getChromaCollectionDetails = async (collectionName) => {
  try {
    const chroma = getChromaClient();
    const collection = await chroma.getCollection({ name: collectionName });

    const count = await collection.count();

    // Get sample data (first 5 items)
    let sampleData = null;
    try {
      const sample = await collection.get({
        limit: 5,
      });
      sampleData = {
        ids: sample.ids || [],
        documents: sample.documents || [],
        metadatas: sample.metadatas || [],
        embeddingsCount: sample.embeddings?.length || 0,
      };
    } catch (error) {
      logger.warn(
        `Error getting sample data for collection ${collectionName}:`,
        error
      );
    }

    return {
      name: collection.name,
      id: collection.id,
      metadata: collection.metadata || {},
      count: count,
      sampleData: sampleData,
    };
  } catch (error) {
    logger.error(`Error getting ChromaDB collection ${collectionName}:`, error);
    throw new Error(`Failed to get collection: ${error.message}`);
  }
};

/**
 * Get user's chatbot collection documents with pagination
 */
export const getChatbotCollectionDocuments = async (
  chatbotId,
  userId,
  options = {}
) => {
  const {
    limit = DEFAULT_PAGE_LIMIT,
    offset = DEFAULT_PAGE_OFFSET,
    search = null,
  } = options;

  // Validate pagination parameters
  const validatedLimit = Math.min(Math.max(1, parseInt(limit)), 200);
  const validatedOffset = Math.max(0, parseInt(offset));

  try {
    // Verify chatbot ownership
    const chatbot = await Chatbot.findOne({ _id: chatbotId, userId });
    if (!chatbot) {
      throw new Error("Chatbot not found or access denied");
    }

    const chroma = getChromaClient();
    const collection = await chroma.getCollection({
      name: chatbot.collectionId,
    });

    // Get documents with pagination
    const result = await collection.get({
      limit: validatedLimit,
      offset: validatedOffset,
    });

    // Filter by search if provided
    let filteredDocuments = result.documents || [];
    let filteredIds = result.ids || [];
    let filteredMetadatas = result.metadatas || [];

    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      const filtered = filteredDocuments
        .map((doc, index) => ({
          id: filteredIds[index],
          document: doc,
          metadata: filteredMetadatas[index],
        }))
        .filter((item) => item.document.toLowerCase().includes(searchLower));

      filteredDocuments = filtered.map((item) => item.document);
      filteredIds = filtered.map((item) => item.id);
      filteredMetadatas = filtered.map((item) => item.metadata);
    }

    return {
      documents: filteredDocuments.map((doc, index) => ({
        id: filteredIds[index],
        text: doc,
        metadata: filteredMetadatas[index] || {},
      })),
      total: result.ids?.length || 0,
      limit: validatedLimit,
      offset: validatedOffset,
    };
  } catch (error) {
    logger.error(
      `Error getting collection documents for chatbot ${chatbotId}:`,
      error
    );
    throw new Error(`Failed to get documents: ${error.message}`);
  }
};

/**
 * Update a specific document in chatbot collection
 */
export const updateChatbotCollectionDocument = async (
  chatbotId,
  userId,
  documentId,
  newText
) => {
  try {
    // Verify chatbot ownership
    const chatbot = await Chatbot.findOne({ _id: chatbotId, userId });
    if (!chatbot) {
      throw new Error("Chatbot not found or access denied");
    }

    if (!newText || newText.trim().length === 0) {
      throw new Error("Document text cannot be empty");
    }

    if (newText.length > MAX_DOCUMENT_LENGTH) {
      throw new Error(
        `Document text cannot exceed ${MAX_DOCUMENT_LENGTH.toLocaleString()} characters`
      );
    }

    const chroma = getChromaClient();
    const collection = await chroma.getCollection({
      name: chatbot.collectionId,
    });

    // Get existing document
    const existing = await collection.get({ ids: [documentId] });
    if (!existing.ids || existing.ids.length === 0) {
      throw new Error("Document not found");
    }

    // Generate new embedding for updated text
    const newEmbedding = await generateEmbeddings(
      [newText],
      chatbot.metadata.embeddingModel
    );

    // Update document
    await collection.update({
      ids: [documentId],
      documents: [newText],
      embeddings: newEmbedding,
      metadatas: [
        {
          ...existing.metadatas[0],
          updatedAt: new Date().toISOString(),
          textLength: newText.length,
        },
      ],
    });

    logger.info(
      `✅ Updated document ${documentId} in chatbot ${chatbotId} collection`
    );

    return {
      success: true,
      documentId,
      message: "Document updated successfully",
    };
  } catch (error) {
    logger.error(
      `Error updating document ${documentId} in chatbot ${chatbotId}:`,
      error
    );
    throw new Error(`Failed to update document: ${error.message}`);
  }
};

/**
 * Delete specific documents from chatbot collection
 */
export const deleteChatbotCollectionDocuments = async (
  chatbotId,
  userId,
  documentIds
) => {
  try {
    // Verify chatbot ownership
    const chatbot = await Chatbot.findOne({ _id: chatbotId, userId });
    if (!chatbot) {
      throw new Error("Chatbot not found or access denied");
    }

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      throw new Error("Document IDs array is required");
    }

    if (documentIds.length > MAX_DELETE_BATCH_SIZE) {
      throw new Error(
        `Cannot delete more than ${MAX_DELETE_BATCH_SIZE} documents at once`
      );
    }

    const chroma = getChromaClient();
    const collection = await chroma.getCollection({
      name: chatbot.collectionId,
    });

    // Delete documents
    await collection.delete({ ids: documentIds });

    // Update chatbot statistics
    chatbot.trainingData.totalChunks = Math.max(
      0,
      chatbot.trainingData.totalChunks - documentIds.length
    );
    await chatbot.save();

    logger.info(
      `✅ Deleted ${documentIds.length} documents from chatbot ${chatbotId} collection`
    );

    return {
      success: true,
      deletedCount: documentIds.length,
      message: "Documents deleted successfully",
    };
  } catch (error) {
    logger.error(`Error deleting documents from chatbot ${chatbotId}:`, error);
    throw new Error(`Failed to delete documents: ${error.message}`);
  }
};

const getOpenAIClient = () => {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
};

/**
 * Generate unique collection ID for chatbot
 */
const generateCollectionId = (userId, chatbotName) => {
  const hash = crypto
    .createHash("md5")
    .update(`${userId}-${chatbotName}-${Date.now()}`)
    .digest("hex");
  return `chatbot-${hash}`;
};

/**
 * Generate unique API key for widget
 */
const generateApiKey = () => {
  return `cb_${crypto.randomBytes(32).toString("hex")}`;
};

/**
 * Create a new chatbot
 */
export const createChatbot = async (
  userId,
  { name, description, config = {}, template = null }
) => {
  try {
    const collectionId = generateCollectionId(userId, name);
    const apiKey = generateApiKey();

    // Apply template if provided
    let finalConfig = config;
    let widgetTheme = {};

    if (template) {
      const templateConfig = await applyTemplate(template, config);
      finalConfig = {
        systemPrompt: templateConfig.systemPrompt,
        temperature: templateConfig.temperature,
        maxTokens: templateConfig.maxTokens,
        topK: templateConfig.topK,
        chunkSize: templateConfig.chunkSize,
        chunkOverlap: templateConfig.chunkOverlap,
      };
      widgetTheme = templateConfig.widget.theme;
    }

    // Create chatbot document
    const chatbot = new Chatbot({
      userId,
      name,
      description: description || "",
      collectionId,
      collectionName: collectionId,
      config: {
        systemPrompt:
          finalConfig.systemPrompt ||
          "You are a helpful AI assistant. Answer questions based on the provided context.",
        temperature: finalConfig.temperature ?? 0.7,
        maxTokens: finalConfig.maxTokens ?? 500,
        topK: finalConfig.topK ?? 5,
        chunkSize: finalConfig.chunkSize ?? 1000,
        chunkOverlap: finalConfig.chunkOverlap ?? 200,
      },
      widget: {
        apiKey,
        enabled: true,
        theme: widgetTheme.primaryColor
          ? widgetTheme
          : {
              primaryColor: "#007bff",
              backgroundColor: "#ffffff",
              position: "bottom-right",
            },
      },
      metadata: {
        model: sanitizeModelId(
          finalConfig.model || config.model || "gpt-3.5-turbo"
        ),
        embeddingModel: sanitizeModelId(
          finalConfig.embeddingModel ||
            config.embeddingModel ||
            "text-embedding-3-small"
        ),
        provider: "openai",
      },
    });

    await chatbot.save();

    // Create ChromaDB collection with embedding function (OpenAI or Ollama)
    const chroma = getChromaClient();
    const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || "openai";

    logger.info(
      `Creating ChromaDB collection with provider: ${EMBEDDING_PROVIDER}`
    );

    let embeddingFunction;
    if (EMBEDDING_PROVIDER === "ollama") {
      // Map OpenAI model names to Ollama model names
      const ollamaModel =
        OLLAMA_EMBEDDING_MODEL_MAP[chatbot.metadata.embeddingModel] ||
        chatbot.metadata.embeddingModel ||
        DEFAULT_OLLAMA_EMBEDDING_MODEL;
      embeddingFunction = new OllamaEmbeddingFunction(ollamaModel);
    } else {
      embeddingFunction = new OpenAIEmbeddingFunction(
        chatbot.metadata.embeddingModel
      );
    }

    await chroma.createCollection({
      name: collectionId,
      embeddingFunction: embeddingFunction,
      metadata: {
        chatbotId: chatbot._id.toString(),
        userId: userId.toString(),
        createdAt: new Date().toISOString(),
      },
    });

    // Set status to active after successful collection creation
    chatbot.status = "active";

    // Initialize training data as empty (no pre-training data)
    // Customer needs to manually add training data after creation
    chatbot.trainingData = {
      totalDocuments: 0,
      totalChunks: 0,
      totalSize: 0,
      trainingStatus: "pending",
      fileTypes: [],
    };

    await chatbot.save();

    // NOTE: Pre-training data auto-load is DISABLED
    // Chatbots are created empty. Customers must manually add training data.
    // This ensures customers understand they need to train the chatbot first.
    //
    // If you want to enable pre-training data in the future, uncomment below:
    // if (template) {
    //   const templateInfo = await getTemplate(template);
    //   if (
    //     templateInfo?.preTrainingData?.enabled &&
    //     templateInfo.preTrainingData.filePath
    //   ) {
    //     try {
    //       loadAndTrainPreTrainingData(
    //         chatbot._id,
    //         templateInfo.preTrainingData.filePath
    //       ).catch((error) => {
    //         logger.warn(
    //           `Failed to load pre-training data for chatbot ${chatbot._id}:`,
    //           error
    //         );
    //       });
    //     } catch (error) {
    //       logger.warn(
    //         `Error setting up pre-training for chatbot ${chatbot._id}:`,
    //         error
    //       );
    //     }
    //   }
    // }

    logger.info(
      `✅ Chatbot created (empty, no pre-training data): ${collectionId} for user ${userId}`
    );

    return chatbot;
  } catch (error) {
    logger.error("Error creating chatbot:", error);
    throw new Error(`Failed to create chatbot: ${error.message}`);
  }
};

/**
 * Train chatbot with text/PDF data
 */
export const trainChatbot = async (chatbotId, filePath, mimetype) => {
  try {
    const chatbot = await Chatbot.findById(chatbotId);
    if (!chatbot) {
      throw new Error("Chatbot not found");
    }

    // Update training status
    await chatbot.updateTrainingStatus("processing");

    // Extract text from file
    const { text, pages } = await extractTextFromUpload(filePath, mimetype);

    // Chunk text
    const chunks = chunkText(
      text,
      chatbot.config.chunkSize,
      chatbot.config.chunkOverlap
    );

    if (chunks.length === 0) {
      throw new Error("No text content found in file");
    }

    // Generate embeddings for all chunks
    const chunkTexts = chunks.map((chunk) => chunk.text);
    const embeddings = await generateEmbeddings(
      chunkTexts,
      chatbot.metadata.embeddingModel
    );

    // Store in ChromaDB
    const chroma = getChromaClient();
    const collection = await chroma.getCollection({
      name: chatbot.collectionId,
    });

    // Prepare documents for ChromaDB
    const documents = chunks.map((chunk, index) => chunk.text);
    const metadatas = chunks.map((chunk, index) => ({
      chunkIndex: index,
      startIndex: chunk.startIndex,
      endIndex: chunk.endIndex,
      chatbotId: chatbotId.toString(),
      uploadedAt: new Date().toISOString(),
    }));
    const ids = chunks.map(
      (_, index) => `${chatbotId}-chunk-${Date.now()}-${index}`
    );

    await collection.add({
      ids,
      embeddings: embeddings,
      documents: documents,
      metadatas: metadatas,
    });

    // Update chatbot statistics
    const fileType = mimetype.includes("pdf") ? "pdf" : "txt";
    if (!chatbot.trainingData.fileTypes.includes(fileType)) {
      chatbot.trainingData.fileTypes.push(fileType);
    }

    // Get file size for tracking
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;

    // Update training status with document count, chunks, and total size
    chatbot.trainingData.totalDocuments += 1;
    chatbot.trainingData.totalChunks += chunks.length;
    chatbot.trainingData.totalSize =
      (chatbot.trainingData.totalSize || 0) + fileSize;
    chatbot.trainingData.lastTrainedAt = new Date();
    chatbot.trainingData.trainingStatus = "completed";
    chatbot.status = "active";
    await chatbot.save();

    logger.info(
      `✅ Chatbot trained: ${chunks.length} chunks added to ${chatbot.collectionId}`
    );

    return {
      chunks: chunks.length,
      pages: pages || 1,
      status: "completed",
    };
  } catch (error) {
    logger.error("Error training chatbot:", error);

    // Update chatbot status to error
    const chatbot = await Chatbot.findById(chatbotId);
    if (chatbot) {
      await chatbot.updateTrainingStatus("failed");
    }

    throw new Error(`Failed to train chatbot: ${error.message}`);
  }
};

/**
 * Load and train chatbot with pre-training data from file
 * @param {string} chatbotId - Chatbot ID
 * @param {string} filePath - Path to pre-training data file
 */
const loadAndTrainPreTrainingData = async (chatbotId, filePath) => {
  try {
    // Resolve file path relative to project root
    const projectRoot = path.join(__dirname, "../../../../../");
    const fullPath = path.join(projectRoot, filePath);

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch (error) {
      logger.warn(`Pre-training data file not found: ${fullPath}`);
      return;
    }

    // Read and train with pre-training data
    const text = await extractTextFromFile(fullPath);
    if (text && text.trim().length > 0) {
      await trainChatbotWithText(chatbotId, text);
      logger.info(`✅ Pre-training data loaded for chatbot ${chatbotId}`);
    }
  } catch (error) {
    logger.error(
      `Error loading pre-training data for chatbot ${chatbotId}:`,
      error
    );
    // Don't throw error - pre-training failure shouldn't block chatbot creation
    // The chatbot is already created and active, pre-training is optional
    return;
  }
};

/**
 * Train chatbot with raw text
 */
export const trainChatbotWithText = async (chatbotId, text) => {
  const startTime = Date.now();

  try {
    const chatbot = await Chatbot.findById(chatbotId);
    if (!chatbot) {
      throw new Error("Chatbot not found");
    }

    // Validate text length
    if (!text || text.trim().length === 0) {
      throw new Error("Text content cannot be empty");
    }

    if (text.length > MAX_TEXT_LENGTH) {
      throw new Error(
        `Text is too large. Maximum ${MAX_TEXT_LENGTH.toLocaleString()} characters allowed. Please split into smaller chunks.`
      );
    }

    logger.info(
      `Starting training for chatbot ${chatbotId}: ${text.length} characters`
    );

    await chatbot.updateTrainingStatus("processing");

    // Chunk text
    const chunks = chunkText(
      text,
      chatbot.config.chunkSize,
      chatbot.config.chunkOverlap
    );

    if (chunks.length === 0) {
      throw new Error("No text content found after chunking");
    }

    logger.info(
      `Text chunked into ${chunks.length} chunks for chatbot ${chatbotId}`
    );

    // Generate embeddings in batches for large texts (to avoid memory issues)
    const chunkTexts = chunks.map((chunk) => chunk.text);
    let allEmbeddings = [];

    if (chunks.length > CHUNK_BATCH_SIZE) {
      logger.info(
        `Processing ${chunks.length} chunks in batches of ${CHUNK_BATCH_SIZE}`
      );

      for (let i = 0; i < chunkTexts.length; i += CHUNK_BATCH_SIZE) {
        const batch = chunkTexts.slice(i, i + CHUNK_BATCH_SIZE);
        logger.info(
          `Generating embeddings for batch ${
            Math.floor(i / CHUNK_BATCH_SIZE) + 1
          }/${Math.ceil(chunkTexts.length / CHUNK_BATCH_SIZE)}`
        );

        const batchEmbeddings = await generateEmbeddings(
          batch,
          chatbot.metadata.embeddingModel
        );
        allEmbeddings = allEmbeddings.concat(batchEmbeddings);
      }
    } else {
      // Generate embeddings for all chunks at once (smaller texts)
      allEmbeddings = await generateEmbeddings(
        chunkTexts,
        chatbot.metadata.embeddingModel
      );
    }

    // Store in ChromaDB
    const chroma = getChromaClient();
    const collection = await chroma.getCollection({
      name: chatbot.collectionId,
    });

    const documents = chunks.map((chunk) => chunk.text);
    const metadatas = chunks.map((chunk, index) => ({
      chunkIndex: index,
      startIndex: chunk.startIndex,
      endIndex: chunk.endIndex,
      chatbotId: chatbotId.toString(),
      uploadedAt: new Date().toISOString(),
      source: "text_training",
      textLength: chunk.text.length,
    }));
    const ids = chunks.map(
      (_, index) => `${chatbotId}-chunk-${Date.now()}-${index}`
    );

    logger.info(
      `Storing ${chunks.length} chunks in ChromaDB for chatbot ${chatbotId}`
    );

    await collection.add({
      ids,
      embeddings: allEmbeddings,
      documents: documents,
      metadatas: metadatas,
    });

    // Update chatbot statistics
    await chatbot.updateTrainingStatus(
      "completed",
      chatbot.trainingData.totalDocuments + 1,
      chatbot.trainingData.totalChunks + chunks.length
    );

    const processingTime = Date.now() - startTime;
    logger.info(
      `✅ Chatbot ${chatbotId} trained successfully: ${chunks.length} chunks processed in ${processingTime}ms`
    );

    return {
      chunks: chunks.length,
      status: "completed",
      textLength: text.length,
      processingTime: processingTime,
      avgChunkSize: Math.round(
        chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) /
          chunks.length
      ),
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(
      `Error training chatbot ${chatbotId} with text (${processingTime}ms):`,
      error
    );

    const chatbot = await Chatbot.findById(chatbotId);
    if (chatbot) {
      await chatbot.updateTrainingStatus("failed");
    }

    throw new Error(`Failed to train chatbot: ${error.message}`);
  }
};

/**
 * Extract expected dimension from ChromaDB dimension mismatch error
 * @param {string} errorMessage - Error message from ChromaDB
 * @returns {number|null} - Expected dimension or null if not found
 */
const extractExpectedDimension = (errorMessage) => {
  const match = errorMessage.match(
    /expecting embedding with dimension of (\d+)/
  );
  return match ? parseInt(match[1], 10) : null;
};

/**
 * Get appropriate embedding model for a given dimension
 * @param {number} dimension - Expected embedding dimension
 * @returns {string} - Model name that produces the required dimension
 */
const getModelForDimension = (dimension) => {
  return DIMENSION_TO_MODEL_MAP[dimension] || "text-embedding-3-small";
};

/**
 * Execute ChromaDB query with timeout handling
 * @param {Object} collection - ChromaDB collection instance
 * @param {number[][]} queryEmbedding - Query embedding vector
 * @param {number} topK - Number of results to return
 * @returns {Promise<Object>} - Query results
 */
const executeVectorQuery = async (collection, queryEmbedding, topK) => {
  let queryTimeoutId;
  const queryTimeoutPromise = new Promise((_, reject) => {
    queryTimeoutId = setTimeout(() => {
      reject(
        new Error(
          `Vector database query timed out after ${
            VECTOR_QUERY_TIMEOUT_MS / 1000
          } seconds`
        )
      );
    }, VECTOR_QUERY_TIMEOUT_MS);
  });

  try {
    const queryPromise = collection.query({
      queryEmbeddings: queryEmbedding,
      nResults: topK,
    });

    const results = await Promise.race([queryPromise, queryTimeoutPromise]);
    clearTimeout(queryTimeoutId);
    return results;
  } catch (error) {
    clearTimeout(queryTimeoutId);
    throw error;
  }
};

/**
 * Query chatbot with RAG (Retrieval Augmented Generation)
 */
export const queryChatbot = async (
  chatbotId,
  query,
  sessionId = null,
  userId = null
) => {
  const startTime = Date.now();

  try {
    const chatbot = await Chatbot.findById(chatbotId);
    if (!chatbot) {
      throw new Error("Chatbot not found");
    }

    // Allow queries for active or training chatbots
    // Training chatbots can still respond (may have partial or no training data)
    if (chatbot.status !== "active" && chatbot.status !== "training") {
      throw new Error(
        `Chatbot is not available. Current status: ${chatbot.status}. Please wait for training to complete or contact support.`
      );
    }

    // Check if chatbot has any training data
    const hasTrainingData = (chatbot.trainingData?.totalDocuments || 0) > 0;
    if (!hasTrainingData) {
      // Return a helpful message when no training data is available
      return {
        response:
          "This chatbot hasn't been trained yet. Please add training data first before querying. You can upload PDF or text files to train your chatbot.",
        context: [],
        sources: [],
        metadata: {
          chatbotId: chatbot._id.toString(),
          query: query,
          hasTrainingData: false,
          message:
            "No training data available. Please train your chatbot first.",
        },
        model: chatbot.metadata.model || "gpt-3.5-turbo",
        processingTime: Date.now() - startTime,
      };
    }

    // Sanitize embedding model ID before using it
    const cleanedEmbeddingModel = sanitizeModelId(
      chatbot.metadata.embeddingModel
    );

    // Get ChromaDB collection
    const chroma = getChromaClient();
    const collection = await chroma.getCollection({
      name: chatbot.collectionId,
    });

    // Generate query embedding and execute query with dimension mismatch handling
    let queryEmbedding = await generateEmbeddings(
      [query],
      cleanedEmbeddingModel
    );
    let results;
    let usedModel = cleanedEmbeddingModel;

    try {
      results = await executeVectorQuery(
        collection,
        queryEmbedding,
        chatbot.config.topK
      );
    } catch (error) {
      // Check if it's a dimension mismatch error
      if (
        error.message &&
        error.message.includes("expecting embedding with dimension")
      ) {
        const expectedDimension = extractExpectedDimension(error.message);

        if (expectedDimension) {
          const correctModel = getModelForDimension(expectedDimension);

          logger.warn(
            `Dimension mismatch detected for chatbot ${chatbotId}. ` +
              `Collection expects ${expectedDimension} dimensions, but got ${
                queryEmbedding[0]?.length || "unknown"
              } with model '${usedModel}'. ` +
              `Retrying with model '${correctModel}' (${expectedDimension} dims).`
          );

          // Regenerate embedding with correct model and original query
          queryEmbedding = await generateEmbeddings([query], correctModel);
          usedModel = correctModel;

          // Retry query with correct dimension
          results = await executeVectorQuery(
            collection,
            queryEmbedding,
            chatbot.config.topK
          );
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    // Extract context from results
    const contextChunks = results.documents[0] || [];

    // Validate query results
    if (contextChunks.length === 0) {
      logger.warn(`No context found for query in chatbot ${chatbotId}`);
      // Return empty context - chatbot will handle gracefully
    }

    // Limit context length to prevent token overflow (roughly 8000 characters = ~2000 tokens)
    let context = contextChunks.join("\n\n");
    if (context.length > MAX_CONTEXT_LENGTH) {
      context = context.substring(0, MAX_CONTEXT_LENGTH) + "...";
      logger.warn(
        `Context truncated for chatbot ${chatbotId} (length: ${context.length})`
      );
    }

    // Build prompt with context
    const systemPrompt = chatbot.config.systemPrompt;

    // Detect simple greetings/casual queries that shouldn't use RAG context
    const simpleGreetings = [
      "hello",
      "hi",
      "hey",
      "good morning",
      "good afternoon",
      "good evening",
      "good night",
      "greetings",
      "what is your name",
      "what's your name",
      "who are you",
      "who are you?",
      "what are you",
      "how are you",
      "how's it going",
      "nice to meet you",
    ];
    const queryLower = query.toLowerCase().trim();
    const isSimpleGreeting = simpleGreetings.some(
      (greeting) =>
        queryLower === greeting ||
        queryLower.startsWith(greeting + " ") ||
        queryLower === greeting + "?"
    );

    // For simple greetings, skip context and let system prompt handle it naturally
    let userPrompt;
    if (isSimpleGreeting) {
      // For greetings, provide explicit instructions for concise, friendly responses
      if (
        queryLower.includes("name") ||
        queryLower.includes("what's your name") ||
        queryLower.includes("who are you")
      ) {
        userPrompt = `${query}\n\nRespond briefly and directly. Just state your name as "My name is NN bot" or similar, without extra explanations.`;
      } else if (
        queryLower.includes("hello") ||
        queryLower.includes("hi") ||
        queryLower.includes("hey")
      ) {
        userPrompt = `${query}\n\nRespond with a friendly greeting. Say "Hello! I'm NN bot, the virtual assistant for Neel Networks. How can I help you today?" or similar. Keep it brief and welcoming.`;
      } else {
        // Other casual questions
        userPrompt = `${query}\n\nThis is a casual question. Respond naturally and briefly using your system instructions. Do not search or reference the knowledge base unless the question specifically asks about company information.`;
      }
    } else if (context) {
      // Original logic for knowledge-based queries
      userPrompt = `Based on the following context, answer the user's question directly and naturally. Do not include "Question:" or "Answer:" labels in your response. Just provide a direct answer.\n\nContext:\n${context}\n\nUser's question: ${query}\n\nIf the context doesn't contain enough information to answer the question, politely say that you don't have that information in the available context.`;
    } else {
      // No context available
      userPrompt = `Answer the user's question directly and naturally. Do not include "Question:" or "Answer:" labels. Just provide a direct answer.\n\nUser's question: ${query}\n\nIf you don't have enough information, politely say so.`;
    }

    // Provider selection: 'openai' or 'ollama'
    const CHAT_PROVIDER =
      process.env.CHAT_PROVIDER || process.env.EMBEDDING_PROVIDER || "openai";

    let response, tokensUsed;

    // Use Ollama if provider is set to ollama
    if (CHAT_PROVIDER === "ollama") {
      // Map OpenAI model names to Ollama model names
      // Using smaller models for better compatibility
      // Sanitize model ID to remove any corruption
      const cleanedModelId = sanitizeModelId(chatbot.metadata.model);
      let ollamaModel =
        OLLAMA_CHAT_MODEL_MAP[cleanedModelId] ||
        cleanedModelId ||
        DEFAULT_OLLAMA_CHAT_MODEL;

      // Try to get completion, with automatic fallback to smaller models on memory error
      let completion;
      let lastError = null;
      const maxRetries = 2;
      let retryCount = 0;

      while (retryCount <= maxRetries) {
        try {
          completion = await getOllamaChatCompletion(
            [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            ollamaModel,
            chatbot.config.temperature,
            chatbot.config.maxTokens
          );
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          // Check if it's a memory error and we can try a smaller model
          if (
            error.message.includes("Insufficient memory") ||
            error.message.includes("system memory") ||
            error.message.includes("unable to load")
          ) {
            if (retryCount < maxRetries) {
              // Try to find a smaller available model
              const smallerModels = [
                "tinyllama", // ~637MB - Smallest
                "gemma3:4b", // ~3.3GB - Small alternative
                "gemma:2b", // ~2GB - Small
                "llama2:7b", // ~4GB - Medium
                "llama2", // ~4GB - Medium
              ];
              const alternativeModel = await findSmallestAvailableModel(
                smallerModels
              );
              if (alternativeModel && alternativeModel !== ollamaModel) {
                logger.warn(
                  `Memory error with model "${ollamaModel}", trying smaller model "${alternativeModel}"`
                );
                ollamaModel = alternativeModel;
                retryCount++;
                continue; // Retry with smaller model
              }
            }
          }
          // If not a memory error or no alternative model, throw the error
          throw error;
        }
      }

      if (!completion) {
        throw lastError || new Error("Failed to get chat completion");
      }

      response = completion.content;
      tokensUsed = completion.tokens;
    } else {
      // Default to OpenAI
      const openai = getOpenAIClient();

      // Sanitize model ID before using it
      const cleanedModelId = sanitizeModelId(chatbot.metadata.model);

      const completionPromise = openai.chat.completions.create({
        model: cleanedModelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: chatbot.config.temperature,
        max_tokens: chatbot.config.maxTokens,
        timeout: CHAT_TIMEOUT_MS,
      });

      // Add timeout handling with cleanup
      let chatTimeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        chatTimeoutId = setTimeout(() => {
          reject(
            new Error(
              `OpenAI API request timed out after ${
                CHAT_TIMEOUT_MS / 1000
              } seconds`
            )
          );
        }, CHAT_TIMEOUT_MS);
      });

      let completion;
      try {
        completion = await Promise.race([completionPromise, timeoutPromise]);
        clearTimeout(chatTimeoutId); // Clear timeout if promise resolves
      } catch (error) {
        clearTimeout(chatTimeoutId); // Clear timeout on error
        throw error;
      }

      let rawResponse = completion.choices[0].message.content;

      // Clean up "Question:" and "Answer:" format patterns for OpenAI responses too
      response = rawResponse
        .replace(/^Question:\s*.+?\n\n?Answer:\s*/is, "") // Remove "Question: ... Answer:" pattern
        .replace(/^Answer:\s*/i, "") // Remove standalone "Answer:" prefix
        .replace(/^Question:\s*/i, "") // Remove standalone "Question:" prefix
        .trim();

      tokensUsed = completion.usage?.total_tokens || 0;
    }

    const responseTime = Date.now() - startTime;

    // Update chatbot statistics
    await chatbot.incrementQuery(true, responseTime);

    // Save conversation if sessionId provided
    if (sessionId && userId) {
      let conversation = await Conversation.findOne({ chatbotId, sessionId });

      if (!conversation) {
        conversation = new Conversation({
          chatbotId,
          userId,
          sessionId,
        });
      }

      await conversation.addMessage("user", query);
      await conversation.addMessage("assistant", response, {
        tokens: tokensUsed,
        responseTime,
        sources: results.ids[0] || [],
      });
    }

    logger.info(`✅ Chatbot query completed in ${responseTime}ms`);

    return {
      response,
      context: contextChunks,
      sources: results.ids[0] || [],
      tokens: tokensUsed,
      responseTime,
    };
  } catch (error) {
    logger.error("Error querying chatbot:", error);

    // Update chatbot statistics
    const chatbot = await Chatbot.findById(chatbotId);
    if (chatbot) {
      await chatbot.incrementQuery(false, Date.now() - startTime);
    }

    throw new Error(`Failed to query chatbot: ${error.message}`);
  }
};

/**
 * Get chatbot by ID
 */
export const getChatbotById = async (chatbotId, userId = null) => {
  const query = { _id: chatbotId };
  if (userId) {
    query.userId = userId;
  }
  const chatbot = await Chatbot.findOne(query);

  // Sanitize model IDs if chatbot exists and save if cleaned
  if (chatbot && chatbot.metadata) {
    const originalModel = chatbot.metadata.model;
    const originalEmbeddingModel = chatbot.metadata.embeddingModel;
    const cleanedModel = sanitizeModelId(originalModel);
    const cleanedEmbeddingModel = sanitizeModelId(originalEmbeddingModel);

    if (
      originalModel !== cleanedModel ||
      originalEmbeddingModel !== cleanedEmbeddingModel
    ) {
      chatbot.metadata.model = cleanedModel;
      chatbot.metadata.embeddingModel = cleanedEmbeddingModel;
      await chatbot.save();
      logger.info(`Cleaned corrupted model IDs for chatbot ${chatbotId}`);
    }
  }

  return chatbot;
};

/**
 * Get all chatbots for a user
 */
export const getUserChatbots = async (userId) => {
  return await Chatbot.find({ userId }).sort({ createdAt: -1 });
};

/**
 * Update chatbot configuration
 */
export const updateChatbot = async (chatbotId, userId, updateData) => {
  try {
    const chatbot = await Chatbot.findOne({ _id: chatbotId, userId });
    if (!chatbot) {
      throw new Error("Chatbot not found or access denied");
    }

    // Update allowed fields
    const allowedFields = [
      "name",
      "description",
      "config.systemPrompt",
      "config.temperature",
      "config.maxTokens",
      "config.topK",
      "config.chunkSize",
      "config.chunkOverlap",
    ];

    if (updateData.name !== undefined) {
      chatbot.name = updateData.name;
    }

    if (updateData.description !== undefined) {
      chatbot.description = updateData.description;
    }

    if (updateData.config) {
      if (updateData.config.systemPrompt !== undefined) {
        chatbot.config.systemPrompt = updateData.config.systemPrompt;
      }
      if (updateData.config.temperature !== undefined) {
        chatbot.config.temperature = updateData.config.temperature;
      }
      if (updateData.config.maxTokens !== undefined) {
        chatbot.config.maxTokens = updateData.config.maxTokens;
      }
      if (updateData.config.topK !== undefined) {
        chatbot.config.topK = updateData.config.topK;
      }
      if (updateData.config.chunkSize !== undefined) {
        chatbot.config.chunkSize = updateData.config.chunkSize;
      }
      if (updateData.config.chunkOverlap !== undefined) {
        chatbot.config.chunkOverlap = updateData.config.chunkOverlap;
      }
    }

    await chatbot.save();
    logger.info(`✅ Chatbot ${chatbotId} updated successfully`);

    return chatbot;
  } catch (error) {
    logger.error(`Error updating chatbot ${chatbotId}:`, error);
    throw new Error(`Failed to update chatbot: ${error.message}`);
  }
};

/**
 * Update widget settings
 */
export const updateChatbotWidget = async (chatbotId, userId, widgetData) => {
  try {
    const chatbot = await Chatbot.findOne({ _id: chatbotId, userId });
    if (!chatbot) {
      throw new Error("Chatbot not found or access denied");
    }

    // Update widget settings
    if (widgetData.enabled !== undefined) {
      chatbot.widget.enabled = widgetData.enabled;
    }

    if (widgetData.regenerateApiKey === true) {
      chatbot.widget.apiKey = generateApiKey();
      logger.info(`✅ API key regenerated for chatbot ${chatbotId}`);
    }

    if (widgetData.theme) {
      if (widgetData.theme.primaryColor !== undefined) {
        chatbot.widget.theme.primaryColor = widgetData.theme.primaryColor;
      }
      if (widgetData.theme.backgroundColor !== undefined) {
        chatbot.widget.theme.backgroundColor = widgetData.theme.backgroundColor;
      }
      if (widgetData.theme.position !== undefined) {
        chatbot.widget.theme.position = widgetData.theme.position;
      }
    }

    // Regenerate widget URL if API key changed
    if (widgetData.regenerateApiKey === true) {
      // baseUrl will be passed from controller
      // This is handled in the controller to use getBaseUrl()
    }

    await chatbot.save();
    logger.info(`✅ Widget settings updated for chatbot ${chatbotId}`);

    return chatbot;
  } catch (error) {
    logger.error(`Error updating widget for chatbot ${chatbotId}:`, error);
    throw new Error(`Failed to update widget: ${error.message}`);
  }
};

/**
 * Delete chatbot
 */
export const deleteChatbot = async (chatbotId, userId) => {
  try {
    const chatbot = await Chatbot.findOne({ _id: chatbotId, userId });
    if (!chatbot) {
      throw new Error("Chatbot not found");
    }

    // Delete ChromaDB collection
    try {
      const chroma = getChromaClient();
      await chroma.deleteCollection({ name: chatbot.collectionId });
    } catch (error) {
      logger.warn(`Failed to delete ChromaDB collection: ${error.message}`);
    }

    // Delete conversations
    await Conversation.deleteMany({ chatbotId });

    // Delete chatbot
    await Chatbot.deleteOne({ _id: chatbotId });

    logger.info(`✅ Chatbot deleted: ${chatbotId}`);

    return true;
  } catch (error) {
    logger.error("Error deleting chatbot:", error);
    throw new Error(`Failed to delete chatbot: ${error.message}`);
  }
};

/**
 * Get conversation history
 */
export const getConversationHistory = async (
  chatbotId,
  sessionId = null,
  limit = 50
) => {
  const query = { chatbotId };
  if (sessionId) {
    query.sessionId = sessionId;
  }

  return await Conversation.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "firstName lastName email");
};

/**
 * Generate widget code
 */
export const generateWidgetCode = (chatbotId, apiKey, baseUrl) => {
  // Validate inputs
  if (!chatbotId || !apiKey || !baseUrl) {
    throw new Error("chatbotId, apiKey, and baseUrl are required");
  }

  // Ensure baseUrl doesn't have trailing slash
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");

  // URL encode parameters to prevent injection
  const encodedChatbotId = encodeURIComponent(chatbotId.toString());
  const encodedApiKey = encodeURIComponent(apiKey.toString());

  // Construct widget URL with properly encoded parameters
  const widgetUrl = `${cleanBaseUrl}/widget.html?id=${encodedChatbotId}&apiKey=${encodedApiKey}`;

  // Escape JavaScript strings to prevent XSS
  // Replace single quotes and backslashes to prevent script injection
  const escapedChatbotId = chatbotId
    .toString()
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
  const escapedApiKey = apiKey
    .toString()
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
  const escapedWidgetUrl = widgetUrl
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');

  // Generate iframe code with properly encoded URL
  // HTML attribute value needs to escape quotes, but URL itself is already properly encoded
  const iframeSrc = widgetUrl.replace(/"/g, "&quot;");
  const iframeCode = `<iframe
  src="${iframeSrc}"
  width="400"
  height="600"
  frameborder="0"
  style="border: none; position: fixed; bottom: 20px; right: 20px; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 12px;"
></iframe>`;

  // Generate script code with properly escaped strings
  const scriptCode = `<script>
  (function() {
    var chatbotId = '${escapedChatbotId}';
    var apiKey = '${escapedApiKey}';
    var widgetUrl = '${escapedWidgetUrl}';
    
    var iframe = document.createElement('iframe');
    iframe.src = widgetUrl;
    iframe.width = '400';
    iframe.height = '600';
    iframe.frameBorder = '0';
    iframe.style.cssText = 'border: none; position: fixed; bottom: 20px; right: 20px; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 12px;';
    
    document.body.appendChild(iframe);
  })();
</script>`;

  return {
    iframe: iframeCode,
    script: scriptCode,
    url: widgetUrl,
  };
};
