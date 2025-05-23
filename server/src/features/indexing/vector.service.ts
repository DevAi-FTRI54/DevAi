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
import { ChatOpenAI } from '@langchain/openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, '../../config/.env'),
});

/**
 * Progress bar - Frontend immediately gets { jobId } and polls /jobs/:id/progress
 */

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

  return store.asRetriever({
    k,
    searchType: 'mmr',
    filter: {
      must: [{ key: 'repoId', match: { value: repoId } }],
    },
  });
}

export async function createCodeRetriever(repoId: string, k = 8) {
  console.log(`Creating retriever for repo: ${repoId}`);
  const baseRetriever = await createRetriever(repoId, k);

  return MultiQueryRetriever.fromLLM({
    llm,
    retriever: baseRetriever,
    queryCount: 3, // Generate multiple search queries from the user's question
  });
}
