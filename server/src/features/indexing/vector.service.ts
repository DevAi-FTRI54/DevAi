import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { TsmorphCodeLoader } from './loader.service';
import { chunkDocuments } from './chunk.service';
import type { Document } from '@langchain/core/documents';

// Why Qdrant over Pinecone - https://qdrant.tech/blog/comparing-qdrant-vs-pinecone-vector-databases
const client = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY,
});

const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-large',
});

// <------ A Single Collection For All Users ------>
const COLLECTION = 'devai_collection_01';

// Supporting documentation: https://js.langchain.com/docs/integrations/retrievers/self_query/qdrant/
export async function upsert(docs: Document[]) {
  const vectorStore = QdrantVectorStore.fromDocuments(docs, embeddings, {
    client,
    collectionName: COLLECTION,
  });

  return vectorStore;
}

// factory so chat can pull retriever later
export async function createRetriever(repoId: string, k = 8) {
  const store = await QdrantVectorStore.fromExistingCollection(embeddings, {
    client,
    collectionName: COLLECTION,
  });

  return store.asRetriever({
    k,
    filter: {
      must: [{ key: 'repoId', match: { value: repoId } }],
    },
  });
}
