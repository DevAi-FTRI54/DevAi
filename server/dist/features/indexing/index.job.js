// Log when worker file loads so we can verify it's being imported
console.log('========================================');
console.log('WORKER FILE: index.job.ts LOADED');
console.log('========================================');
import IORedis from 'ioredis';
import { Worker, Queue } from 'bullmq';
import { cloneRepo } from './git.service.js';
import { TsmorphCodeLoader } from './loader.service.js';
import { chunkDocuments } from './chunk.service.js';
import { upsert } from './vector.service.js';
console.log('🔍 REDIS_URL:', process.env.REDIS_URL ? 'Set' : 'Missing');
console.log('🚀 Initializing BullMQ worker...');
// Create Redis client - use lazy connect so it doesn't block server startup
let redisClient;
if (!process.env.REDIS_URL) {
    console.error('⚠️ REDIS_URL not set - worker will not function');
    // Create a dummy client that will fail gracefully
    redisClient = new IORedis('redis://localhost:6379', {
        lazyConnect: true,
        maxRetriesPerRequest: null,
        retryStrategy: () => null, // Don't retry if connection fails
    });
}
else {
    redisClient = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
            // Retry with exponential backoff
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        lazyConnect: true, // Don't connect immediately, wait for first use
    });
    console.log('✅ Redis client created (lazy connect)');
}
export const indexQueue = new Queue('index', {
    connection: redisClient,
});
console.log('✅ Index queue created');
const IDLE_SLEEP_MS = 15 * 60 * 1000; // 15 minutes
let worker = null;
let sleepTimer = null;
function scheduleWorkerSleep() {
    if (sleepTimer)
        clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => {
        const w = worker;
        worker = null;
        sleepTimer = null;
        if (w) {
            w.close().then(() => console.log('😴 Worker sleeping (no jobs for 15 min)'));
        }
    }, IDLE_SLEEP_MS);
}
/** Call before adding a job so the worker is running; resolves when worker is ready. */
export function ensureWorker() {
    if (worker) {
        if (sleepTimer) {
            clearTimeout(sleepTimer);
            sleepTimer = null;
        }
        return Promise.resolve();
    }
    if (!process.env.REDIS_URL)
        return Promise.resolve();
    if (sleepTimer) {
        clearTimeout(sleepTimer);
        sleepTimer = null;
    }
    return new Promise((resolve, reject) => {
        try {
            console.log('🔧 Waking BullMQ worker...');
            const w = new Worker('index', async (job) => {
                // Log when job starts processing
                console.log(`\n🎯 WORKER: Job ${job.id} started processing`);
                console.log(`📋 Job data:`, JSON.stringify(job.data, null, 2));
                // Wrap everything in try-catch to catch and log all errors
                try {
                    const { repoUrl, sha } = job.data;
                    console.log(`📍 Step 1: Cloning repository ${repoUrl}...`);
                    const { localRepoPath, repoId } = await cloneRepo(repoUrl, sha);
                    console.log(`✅ Repository cloned to: ${localRepoPath}`);
                    await job.updateProgress(15);
                    console.log(`📍 Step 2: Loading documents with TsmorphCodeLoader...`);
                    const loader = new TsmorphCodeLoader(localRepoPath, repoId);
                    const bigDocs = await loader.load();
                    console.log(`✅ Loader completed`);
                    console.log(`📄 Loaded ${bigDocs?.length || 0} documents`);
                    // Validate documents before proceeding
                    if (!bigDocs || !Array.isArray(bigDocs)) {
                        throw new Error(`Invalid documents array: ${typeof bigDocs}`);
                    }
                    if (bigDocs.length === 0) {
                        throw new Error('No documents loaded from repository');
                    }
                    // Update progress and start chunking - wrapped in try-catch since jobs were failing here
                    console.log(`📍 Step 3: Updating progress to 30% and starting chunking...`);
                    try {
                        await job.updateProgress(30);
                        console.log(`✅ Progress updated to 30%`);
                    }
                    catch (progressError) {
                        console.error('❌ Failed to update progress to 30%:', progressError);
                        throw new Error(`Progress update failed: ${progressError.message}`);
                    }
                    // Chunk documents with error handling
                    let chunkedDocs;
                    try {
                        console.log('🔄 Starting to chunk documents...');
                        chunkedDocs = await chunkDocuments(bigDocs);
                        console.log(`✅ Chunked into ${chunkedDocs.length} documents`);
                    }
                    catch (chunkError) {
                        console.error('❌ Error during chunking:', chunkError);
                        throw new Error(`Failed to chunk documents: ${chunkError.message}`);
                    }
                    chunkedDocs = chunkedDocs.map((doc) => {
                        if (!doc.pageContent || doc.pageContent.trim().length === 0) {
                            return {
                                ...doc,
                                pageContent: 'Empty file',
                                metaData: {
                                    ...doc.metadata,
                                    isEmpty: true,
                                },
                            };
                        }
                        return doc;
                    });
                    const total = chunkedDocs.length;
                    console.log(`📊 Total documents to process: ${total}`);
                    await job.updateProgress(36);
                    // Batch processing: Instead of processing one document at a time (slow and expensive),
                    // we process 50 documents together. This is much faster and reduces API costs.
                    // Processing 5 batches at the same time speeds things up even more.
                    const BATCH_SIZE = 50; // Documents per batch
                    const CONCURRENT_BATCHES = 5; // How many batches to process simultaneously
                    // Process a batch of documents together (faster than one-by-one)
                    const processBatch = async (batch, batchIndex) => {
                        try {
                            console.log(`🔄 Processing batch ${batchIndex + 1} with ${batch.length} documents`);
                            await upsert(batch);
                            console.log(`✅ Completed batch ${batchIndex + 1}`);
                            return batch.length;
                        }
                        catch (error) {
                            const msg = (error?.message || String(error)).toLowerCase();
                            const code = error?.code ?? '';
                            const isQdrantConnection = code === 'ECONNREFUSED' ||
                                code === 'ETIMEDOUT' ||
                                msg.includes('qdrant') ||
                                msg.includes('econnrefused') ||
                                msg.includes('etimedout') ||
                                msg.includes('connection refused') ||
                                msg.includes('fetch failed') ||
                                msg.includes('service unavailable') ||
                                msg.includes('502') ||
                                msg.includes('503') ||
                                msg.includes('network error');
                            if (isQdrantConnection) {
                                console.error(`❌ INGESTION ERROR: Batch ${batchIndex + 1} failed — Qdrant connection unavailable. Free tier may be suspended after inactivity; check Qdrant dashboard.`, { error: error?.message || error });
                            }
                            console.error(`❌ Failed to process batch ${batchIndex + 1}:`, error);
                            throw error;
                        }
                    };
                    // Split all documents into smaller batches
                    const batches = [];
                    for (let i = 0; i < total; i += BATCH_SIZE) {
                        batches.push(chunkedDocs.slice(i, i + BATCH_SIZE));
                    }
                    console.log(`📦 Split into ${batches.length} batches of up to ${BATCH_SIZE} documents each`);
                    // Process multiple batches at the same time for speed
                    // This processes CONCURRENT_BATCHES batches simultaneously instead of waiting for each one
                    let processedCount = 0;
                    const progressRange = 64; // Progress from 36% to 100%
                    for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
                        // Process CONCURRENT_BATCHES batches at once
                        const currentBatches = batches.slice(i, i + CONCURRENT_BATCHES);
                        const results = await Promise.all(currentBatches.map((batch, index) => processBatch(batch, i + index)));
                        processedCount += results.reduce((sum, count) => sum + count, 0);
                        const percentage = 36 + Math.floor((processedCount / total) * progressRange);
                        console.log(`📈 Progress: ${processedCount}/${total} documents (${percentage}%)`);
                        await job.updateProgress(percentage);
                    }
                    console.log(`🎉 Successfully processed all ${total} documents!`);
                }
                catch (error) {
                    const msg = (error?.message || String(error)).toLowerCase();
                    const code = error?.code ?? '';
                    const isQdrantConnection = code === 'ECONNREFUSED' ||
                        code === 'ETIMEDOUT' ||
                        msg.includes('qdrant') ||
                        msg.includes('econnrefused') ||
                        msg.includes('etimedout') ||
                        msg.includes('connection refused') ||
                        msg.includes('fetch failed') ||
                        msg.includes('service unavailable') ||
                        msg.includes('502') ||
                        msg.includes('503') ||
                        msg.includes('network error');
                    if (isQdrantConnection) {
                        console.error('❌ INGESTION ERROR: Job failed due to Qdrant connection/availability. If using Qdrant Cloud free tier, the cluster may be suspended after inactivity — check the Qdrant dashboard or try again later.');
                    }
                    console.error('❌ Job failed with error:', error);
                    console.error('Error stack:', error.stack);
                    throw error; // Re-throw to mark job as failed
                }
            }, {
                connection: redisClient,
            })
                .on('ready', () => {
                console.log('✅ BullMQ Worker is ready and listening for jobs');
                resolve();
            })
                .on('active', (job) => {
                console.log(`🟢 Worker: Job ${job.id} is now active`);
            })
                .on('completed', (job) => {
                console.log(`✅ Job ${job.id} has completed!`);
                scheduleWorkerSleep();
            })
                .on('failed', (job, err) => {
                const msg = (err?.message || '').toLowerCase();
                const code = err?.code ?? '';
                const likelyQdrant = code === 'ECONNREFUSED' ||
                    code === 'ETIMEDOUT' ||
                    msg.includes('qdrant') ||
                    msg.includes('econnrefused') ||
                    msg.includes('etimedout') ||
                    msg.includes('connection refused') ||
                    msg.includes('fetch failed') ||
                    msg.includes('service unavailable') ||
                    msg.includes('502') ||
                    msg.includes('503') ||
                    msg.includes('network error');
                console.error(`\n❌❌❌ JOB FAILED ❌❌❌`);
                console.error(`Job ID: ${job?.id}`);
                console.error(`Error message: ${err.message}`);
                if (likelyQdrant) {
                    console.error(`❌ LIKELY CAUSE: Qdrant connection failed (e.g. free tier suspended after inactivity). Check Qdrant dashboard and ensure the cluster is running.`);
                }
                console.error(`Error name: ${err.name}`);
                console.error(`Full error object:`, err);
                if (err.stack) {
                    console.error(`Error stack:\n${err.stack}`);
                }
                scheduleWorkerSleep();
            })
                .on('error', (err) => {
                console.error('❌ Worker error:', err);
            });
            worker = w;
            console.log('✅ BullMQ Worker created and configured');
        }
        catch (workerError) {
            console.error('❌ Failed to create BullMQ worker:', workerError);
            reject(workerError);
        }
    });
}
