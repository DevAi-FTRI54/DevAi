// import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { TsmorphCodeLoader } from './loader.service.js';
import { chunkDocuments } from './chunk.service.js';
import type { Document } from '@langchain/core/documents';
import { MultiQueryRetriever } from 'langchain/retrievers/multi_query';
// import { MultiQueryRetriever } from '@langchain/community/retrievers/multi_query';
import { ChatOpenAI } from '@langchain/openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, '../../config/.env'),
});

// Why Qdrant over Pinecone - https://qdrant.tech/blog/comparing-qdrant-vs-pinecone-vector-databases
// Lazy client initialization to avoid module-level environment access and improve startup speed
let client: QdrantClient | null = null;

function getQdrantClient(): QdrantClient {
  if (!client) {
    console.log('🔍 Initializing Qdrant client...');
    client = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY,
});
  }
  return client;
}

const llm = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0,
  maxTokens: undefined,
  timeout: undefined,
  maxRetries: 2,
  apiKey: process.env.OPENAI_API_KEY,
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
    console.warn('⚠️ upsert called with empty documents array');
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
      console.log('🔄 Creating Qdrant index on first query...');
      await ensureQdrantIndexes();
      console.log('✅ Qdrant index created successfully on first query');
    } catch (err) {
      console.warn(
        '⚠️ Failed to create Qdrant index on first query, continuing:',
        err instanceof Error ? err.message : err
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
    console.log(`Found ${points.points?.length || 0} matching documents`);
  } catch (err: any) {
    console.error('Error querying points:', err.message);
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
    console.log(`Creating retriever for repo: ${repoId}`);
    const baseRetriever = await createRetriever(repoId, k);

    return MultiQueryRetriever.fromLLM({
      llm,
      retriever: baseRetriever,
      queryCount: 3, // Generate multiple search queries from the user's question
    });
  } catch (err) {
    console.error('Error creating code retriever: ', err);
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
      console.log(`✅ Collection '${COLLECTION}' already exists`);
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
        console.log(
          `🔄 Collection '${COLLECTION}' doesn't exist, creating it...`
        );

        // text-embedding-3-large produces 3072-dimensional vectors
        try {
          await qdrantClient.createCollection(COLLECTION, {
            vectors: {
              size: 3072,
              distance: 'Cosine',
            },
          });
          console.log(`✅ Collection '${COLLECTION}' created successfully`);
        } catch (createErr: any) {
          // Handle race condition where collection might have been created between check and creation
          const createErrorMessage =
            createErr?.message || createErr?.status?.error || '';
          if (
            createErrorMessage.includes('already exists') ||
            createErrorMessage.includes('already exist')
          ) {
            console.log(
              `✅ Collection '${COLLECTION}' was created by another process`
            );
          } else {
            throw createErr;
          }
        }
      } else {
        // Re-throw if it's a different error
        console.error('❌ Unexpected error checking collection:', err);
        throw err;
      }
    }

    // Now create the index on the collection (whether it existed or was just created)
    console.log('Creating index for metadata.repoId...');
    await qdrantClient.createPayloadIndex(COLLECTION, {
      field_name: 'metadata.repoId',
      field_schema: 'keyword',
    });
    console.log('✅ Index created for metadata.repoId');
  } catch (err: any) {
    if (err.message?.includes('already exists')) {
      console.log('✅ Index for metadata.repoId already exists');
      return;
    }
    console.error('❌ Failed to create index:', err);
    throw err;
  }
}

/*

# Delete all points (preserves collection structure)
curl -X POST \
  "https://0f6afb8c-4472-4502-be39-0a91ca34a202.us-east4-0.gcp.cloud.qdrant.io:6333/collections/devai_collection_01/points/delete" \
  -H "Content-Type: application/json" \
  -H "api-key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.c2o3HTYK_ITBNNga99GCfAo628GNaoFfLi1kArxiJsE" \
  -d '{"filter": {}}'

# OR delete entire collection
curl -X DELETE \
  "https://0f6afb8c-4472-4502-be39-0a91ca34a202.us-east4-0.gcp.cloud.qdrant.io:6333/collections/devai_collection_01" \
  -H "api-key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.c2o3HTYK_ITBNNga99GCfAo628GNaoFfLi1kArxiJsE"

 */
