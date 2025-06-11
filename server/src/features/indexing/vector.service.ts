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
const client = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY,
});

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
export async function upsert(docs: Document[]) {
  const vectorStore = QdrantVectorStore.fromDocuments(docs, embeddings, {
    client,
    collectionName: COLLECTION,
  });

  return vectorStore;
}

// -- asRetriever ----------------------------------------------------
// Factory asRetriever so chat can pull retriever later
// https://js.langchain.com/docs/how_to/vectorstore_retriever/
export async function createRetriever(repoId: string, k = 8) {
  const store = await QdrantVectorStore.fromExistingCollection(embeddings, {
    client,
    collectionName: COLLECTION,
  });

  try {
    const points = await client.scroll(COLLECTION, {
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
    // First, ensure the collection exists
    console.log(`Checking if collection "${COLLECTION}" exists...`);

    try {
      await client.getCollection(COLLECTION);
      console.log(`✅ Collection "${COLLECTION}" exists`);
    } catch (err: any) {
      if (err.status === 404) {
        console.log(`Creating collection "${COLLECTION}"...`);
        await client.createCollection(COLLECTION, {
          vectors: {
            size: 3072, // text-embedding-3-large dimension
            distance: 'Cosine',
          },
        });
        console.log(`✅ Collection "${COLLECTION}" created`);
      } else {
        throw err;
      }
    }

    // Now create the index
    console.log('Creating index for metadata.repoId...');
    await client.createPayloadIndex(COLLECTION, {
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
