// import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
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
let client = null;
function getQdrantClient() {
    if (!client) {
        console.log('🔍 Initializing Qdrant client...');
        client = new QdrantClient({
            url: process.env.QDRANT_URL,
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
const QDRANT_UNAVAILABLE_HINT = 'If using Qdrant Cloud free tier, the cluster may be suspended after inactivity — check the Qdrant dashboard or try again after it resumes.';
// Only true when the error clearly indicates Qdrant or network/connection failure (not e.g. OpenAI or validation errors).
function isQdrantConnectionError(err) {
    const code = err?.code ?? '';
    const msg = (err?.message || String(err)).toLowerCase();
    if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT')
        return true;
    return (msg.includes('qdrant') ||
        msg.includes('econnrefused') ||
        msg.includes('etimedout') ||
        msg.includes('connection refused') ||
        msg.includes('fetch failed') ||
        msg.includes('service unavailable') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('network error'));
}
// Upsert documents to vector store - handles batching automatically for efficiency
export async function upsert(docs) {
    if (!docs || docs.length === 0) {
        console.warn('⚠️ upsert called with empty documents array');
        return;
    }
    try {
        const vectorStore = QdrantVectorStore.fromDocuments(docs, embeddings, {
            client: getQdrantClient(),
            collectionName: COLLECTION,
        });
        return vectorStore;
    }
    catch (err) {
        const msg = err?.message || String(err);
        if (isQdrantConnectionError(err)) {
            console.error('❌ INGESTION ERROR: Qdrant upsert failed (no connection or Qdrant unavailable).', {
                error: msg,
                docCount: docs.length,
                hint: QDRANT_UNAVAILABLE_HINT,
            });
        }
        else {
            console.error('❌ INGESTION ERROR: Upsert failed.', {
                error: msg,
                docCount: docs.length,
            });
        }
        console.error('❌ Ingestion failure details:', err?.stack || err);
        throw err;
    }
}
// -- asRetriever ----------------------------------------------------
// Factory asRetriever so chat can pull retriever later
// https://js.langchain.com/docs/how_to/vectorstore_retriever/
// Index creation state tracking - only create index once per server session
let indexCreationAttempted = false;
export async function createRetriever(repoId, k = 8) {
    // Ensure index exists (only try once per server session for better performance)
    if (!indexCreationAttempted) {
        indexCreationAttempted = true;
        try {
            console.log('🔄 Creating Qdrant index on first query...');
            await ensureQdrantIndexes();
            console.log('✅ Qdrant index created successfully on first query');
        }
        catch (err) {
            console.warn('⚠️ Failed to create Qdrant index on first query, continuing:', err instanceof Error ? err.message : err);
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
    }
    catch (err) {
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
export async function createCodeRetriever(repoId, k = 8) {
    try {
        console.log(`Creating retriever for repo: ${repoId}`);
        const baseRetriever = await createRetriever(repoId, k);
        return MultiQueryRetriever.fromLLM({
            llm,
            retriever: baseRetriever,
            queryCount: 3, // Generate multiple search queries from the user's question
        });
    }
    catch (err) {
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
        }
        catch (err) {
            // Collection doesn't exist, create it
            // Check for various error formats that indicate collection doesn't exist
            const errorMessage = err?.message || err?.status?.error || '';
            const isNotFoundError = errorMessage.includes("doesn't exist") ||
                errorMessage.includes('Not found') ||
                errorMessage.includes('not found') ||
                err?.status === 404 ||
                err?.statusCode === 404;
            if (isNotFoundError) {
                console.log(`🔄 Collection '${COLLECTION}' doesn't exist, creating it...`);
                // text-embedding-3-large produces 3072-dimensional vectors
                try {
                    await qdrantClient.createCollection(COLLECTION, {
                        vectors: {
                            size: 3072,
                            distance: 'Cosine',
                        },
                    });
                    console.log(`✅ Collection '${COLLECTION}' created successfully`);
                }
                catch (createErr) {
                    // Handle race condition where collection might have been created between check and creation
                    const createErrorMessage = createErr?.message || createErr?.status?.error || '';
                    if (createErrorMessage.includes('already exists') ||
                        createErrorMessage.includes('already exist')) {
                        console.log(`✅ Collection '${COLLECTION}' was created by another process`);
                    }
                    else {
                        if (isQdrantConnectionError(createErr)) {
                            console.error('❌ QDRANT CONNECTION ERROR: Failed to create collection.', {
                                error: createErr?.message || createErr,
                                hint: QDRANT_UNAVAILABLE_HINT,
                            });
                        }
                        else {
                            console.error('❌ Failed to create collection:', createErr?.message || createErr);
                        }
                        throw createErr;
                    }
                }
            }
            else {
                if (isQdrantConnectionError(err)) {
                    console.error('❌ QDRANT CONNECTION ERROR: Could not reach Qdrant or collection check failed.', { error: err?.message || err, hint: QDRANT_UNAVAILABLE_HINT });
                }
                else {
                    console.error('❌ Unexpected error checking collection:', err?.message || err);
                }
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
    }
    catch (err) {
        if (err.message?.includes('already exists')) {
            console.log('✅ Index for metadata.repoId already exists');
            return;
        }
        if (isQdrantConnectionError(err)) {
            console.error('❌ QDRANT CONNECTION ERROR: Failed to create or ensure Qdrant index.', { error: err?.message || err, hint: QDRANT_UNAVAILABLE_HINT });
        }
        else {
            console.error('❌ Failed to create or ensure Qdrant index:', err?.message || err);
        }
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
