import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { TsmorphCodeLoader } from './loader.service.js';
import { chunkDocuments } from './chunk.service.js';
import type { Document } from '@langchain/core/documents';
import { MultiQueryRetriever } from 'langchain/retrievers/multi_query';
import { ChatOpenAI } from '@langchain/openai';
import {
  QDRANT_URL,
  QDRANT_API_KEY,
  OPENAI_API_KEY,
} from '../../config/env.validation.js';
import { logger } from '../../utils/logger.js';

/**
 * Vector Database and AI Service Configuration
 *
 * This file sets up our AI/ML infrastructure:
 * - Qdrant: Our vector database for storing code embeddings (semantic search)
 * - OpenAI: Powers our code understanding and question answering
 *
 * Why Qdrant over Pinecone? Check out this comparison:
 * https://qdrant.tech/blog/comparing-qdrant-vs-pinecone-vector-databases
 *
 * We use lazy initialization for the Qdrant client - this means we don't connect to it
 * until we actually need it. This improves server startup time and prevents connection
 * errors if Qdrant isn't available immediately (maybe it's still starting up).
 */

// Lazy client initialization - we'll create the connection when we first need it
// This is better than connecting at module load time because:
// 1. Faster server startup (doesn't block on database connection)
// 2. More resilient (can handle Qdrant being temporarily unavailable)
// 3. Better error handling (can retry connection when actually needed)
let client: QdrantClient | null = null;

/**
 * Get or create the Qdrant client
 *
 * This function implements the singleton pattern - we only create one Qdrant client
 * and reuse it for all operations. This is more efficient than creating a new client
 * for every request.
 *
 * The client is initialized with our validated environment variables, so we know
 * the URL is valid and the API key (if provided) is in the right format.
 *
 * @returns The Qdrant client instance
 */
function getQdrantClient(): QdrantClient {
  if (!client) {
    logger.info('🔍 Initializing Qdrant client...');
    client = new QdrantClient({
      url: QDRANT_URL, // Validated at startup - guaranteed to be a valid URL
      apiKey: QDRANT_API_KEY, // Optional - only needed if Qdrant requires authentication
    });
  }
  return client;
}

/**
 * OpenAI LLM instance for code understanding
 *
 * We use GPT-4o-mini for generating answers to user questions. It's a good balance
 * of capability and cost - powerful enough to understand code context, but not so
 * expensive that we can't afford to use it for every query.
 *
 * The API key comes from our validated environment configuration, so we know it's
 * present and in the correct format (starts with 'sk-') before we try to use it.
 */
const llm = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0, // Low temperature for more consistent, factual responses
  maxTokens: undefined, // Let the model decide based on context
  timeout: undefined, // Use default timeout
  maxRetries: 2, // Retry failed requests up to 2 times
  apiKey: OPENAI_API_KEY, // Validated at startup - guaranteed to be valid
});

const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-large',
});

// --- A Single Collection For All Users ------------------------------
const COLLECTION = 'devai_collection_01';

// Supporting documentation: https://js.langchain.com/docs/integrations/retrievers/self_query/qdrant/
// Upsert documents to vector store - handles batching automatically for efficiency
export async function upsert(docs: Document[]) {
  if (!docs || docs.length === 0) {
    logger.warn('⚠️ upsert called with empty documents array');
    return;
  }

  // This automatically batches embeddings API calls (OpenAI supports up to 2048 per request)
  // and batches Qdrant upserts, making it much faster and cheaper than processing one-by-one
  const vectorStore = QdrantVectorStore.fromDocuments(docs, embeddings, {
    client: getQdrantClient(),
    collectionName: COLLECTION,
  });

  return vectorStore;
}

// -- asRetriever ----------------------------------------------------
// Factory asRetriever so chat can pull retriever later
// https://js.langchain.com/docs/how_to/vectorstore_retriever/
// Index creation state tracking - only create index once per server session
let indexCreationAttempted = false;

export async function createRetriever(repoId: string, k = 8) {
  // Ensure index exists (only try once per server session for better performance)
  if (!indexCreationAttempted) {
    indexCreationAttempted = true;
    try {
      logger.info('🔄 Creating Qdrant index on first query...');
      await ensureQdrantIndexes();
      logger.info('✅ Qdrant index created successfully on first query');
    } catch (err) {
      logger.warn(
        '⚠️ Failed to create Qdrant index on first query, continuing',
        {
          err: err instanceof Error ? err.message : err,
        },
      );
      // Continue without index - filtering will still work, just slower
    }
  }

  const store = await QdrantVectorStore.fromExistingCollection(embeddings, {
    client: getQdrantClient(),
    collectionName: COLLECTION,
  });

  try {
    const qdrantClient = getQdrantClient();
    const points = await qdrantClient.scroll(COLLECTION, {
      filter: { must: [{ key: 'metadata.repoId', match: { value: repoId } }] },
      limit: 5,
    });
    logger.debug(`Found ${points.points?.length || 0} matching documents`);
  } catch (err: any) {
    logger.error('Error querying points', { message: err.message });
    // Continue execution
  }

  return store.asRetriever({
    k,
    searchType: 'mmr',
    filter: {
      must: [{ key: 'metadata.repoId', match: { value: repoId } }],
    },
  });
}

export async function createCodeRetriever(repoId: string, k = 8) {
  try {
    logger.info(`Creating retriever for repo: ${repoId}`);
    const baseRetriever = await createRetriever(repoId, k);

    return MultiQueryRetriever.fromLLM({
      llm,
      retriever: baseRetriever,
      queryCount: 3, // Generate multiple search queries from the user's question
    });
  } catch (err) {
    logger.error('Error creating code retriever', { err });
    throw err;
  }
}

// Filtering: https://qdrant.tech/documentation/concepts/filtering/
// Indexing: https://qdrant.tech/documentation/concepts/indexing/
// Vector Search Tutorial: https://qdrant.tech/articles/vector-search-filtering/
export async function ensureQdrantIndexes() {
  try {
    const qdrantClient = getQdrantClient();
    // First, check if collection exists and create it if it doesn't
    try {
      const collectionInfo = await qdrantClient.getCollection(COLLECTION);
      logger.debug(`✅ Collection '${COLLECTION}' already exists`);
    } catch (err: any) {
      // Collection doesn't exist, create it
      // Check for various error formats that indicate collection doesn't exist
      const errorMessage = err?.message || err?.status?.error || '';
      const isNotFoundError =
        errorMessage.includes("doesn't exist") ||
        errorMessage.includes('Not found') ||
        errorMessage.includes('not found') ||
        err?.status === 404 ||
        err?.statusCode === 404;

      if (isNotFoundError) {
        logger.info(
          `🔄 Collection '${COLLECTION}' doesn't exist, creating it...`,
        );

        // text-embedding-3-large produces 3072-dimensional vectors
        try {
          await qdrantClient.createCollection(COLLECTION, {
            vectors: {
              size: 3072,
              distance: 'Cosine',
            },
          });
          logger.info(`✅ Collection '${COLLECTION}' created successfully`);
        } catch (createErr: any) {
          // Handle race condition where collection might have been created between check and creation
          const createErrorMessage =
            createErr?.message || createErr?.status?.error || '';
          if (
            createErrorMessage.includes('already exists') ||
            createErrorMessage.includes('already exist')
          ) {
            logger.info(
              `✅ Collection '${COLLECTION}' was created by another process`,
            );
          } else {
            throw createErr;
          }
        }
      } else {
        // Re-throw if it's a different error
        logger.error('❌ Unexpected error checking collection', { err });
        throw err;
      }
    }

    // Now create the index on the collection (whether it existed or was just created)
    logger.info('Creating index for metadata.repoId...');
    await qdrantClient.createPayloadIndex(COLLECTION, {
      field_name: 'metadata.repoId',
      field_schema: 'keyword',
    });
    logger.info('✅ Index created for metadata.repoId');
  } catch (err: any) {
    if (err.message?.includes('already exists')) {
      logger.debug('✅ Index for metadata.repoId already exists');
      return;
    }
    logger.error('❌ Failed to create index', { err });
    throw err;
  }
}
