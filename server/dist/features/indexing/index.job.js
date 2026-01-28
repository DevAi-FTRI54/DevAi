// Log when worker file loads so we can verify it's being imported
/**
 * Background Job Worker for Repository Indexing
 *
 * This file sets up a BullMQ worker that processes repository indexing jobs in the background.
 * When a user wants to index a repository, we don't do it synchronously (which would block
 * the API response) - instead, we queue a job and process it here.
 *
 * The worker handles the entire indexing pipeline:
 * 1. Clone the repository (or fetch via GitHub API)
 * 2. Load and parse code files
 * 3. Chunk the code into semantic pieces
 * 4. Generate embeddings
 * 5. Store in vector database
 *
 * This runs asynchronously so users get a quick response ("indexing started!") and can
 * check the status later, rather than waiting minutes for large repositories to process.
 */
import IORedis from 'ioredis';
import { Worker, Queue } from 'bullmq';
import { cloneRepo } from './git.service.js';
import { TsmorphCodeLoader } from './loader.service.js';
import { chunkDocuments } from './chunk.service.js';
import { upsert } from './vector.service.js';
import { REDIS_URL } from '../../config/env.validation.js';
import { logger } from '../../utils/logger.js';
logger.info('========================================');
logger.info('WORKER FILE: index.job.ts LOADED');
logger.info('========================================');
logger.info('🔍 REDIS_URL', { configured: !!REDIS_URL });
logger.info('🚀 Initializing BullMQ worker...');
/**
 * Redis Client for BullMQ
 *
 * BullMQ uses Redis as its message broker - jobs are stored in Redis queues, and workers
 * pull jobs from those queues. This gives us:
 * - Persistence (jobs survive server restarts)
 * - Scalability (multiple workers can process jobs)
 * - Reliability (failed jobs can be retried)
 *
 * We use lazy connection (lazyConnect: true) so the Redis connection doesn't block server
 * startup. The connection will be established when the first job is processed, which is
 * perfect because we might not have any jobs to process immediately.
 *
 * The Redis URL comes from our validated environment configuration, so we know it's present
 * and valid before we try to use it.
 */
let redisClient;
// Create Redis client with validated URL
// We use lazy connection so it doesn't block server startup
redisClient = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // BullMQ handles retries, not IORedis
    retryStrategy: (times) => {
        // Exponential backoff for reconnection attempts
        // Start with 50ms, increase each time, cap at 2 seconds
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    lazyConnect: true, // Don't connect immediately - wait until we actually need it
});
logger.info('✅ Redis client created (lazy connect)');
export const indexQueue = new Queue('index', {
    connection: redisClient,
});
logger.info('✅ Index queue created');
// Create worker - wrap in try-catch so errors don't crash server startup
let worker;
try {
    logger.info('🔧 Creating BullMQ worker...');
    worker = new Worker('index', async (job) => {
        // Log when job starts processing
        logger.info(`🎯 WORKER: Job ${job.id} started processing`, {
            jobId: job.id,
            jobData: job.data,
        });
        // Wrap everything in try-catch to catch and log all errors
        try {
            const { repoUrl, sha } = job.data;
            logger.info(`📍 Step 1: Cloning repository ${repoUrl}...`);
            const { localRepoPath, repoId } = await cloneRepo(repoUrl, sha);
            logger.info(`✅ Repository cloned to: ${localRepoPath}`);
            await job.updateProgress(15);
            logger.info(`📍 Step 2: Loading documents with TsmorphCodeLoader...`);
            const loader = new TsmorphCodeLoader(localRepoPath, repoId);
            const bigDocs = await loader.load();
            logger.info(`✅ Loader completed`);
            logger.info(`📄 Loaded ${bigDocs?.length || 0} documents`);
            // Validate documents before proceeding
            if (!bigDocs || !Array.isArray(bigDocs)) {
                throw new Error(`Invalid documents array: ${typeof bigDocs}`);
            }
            if (bigDocs.length === 0) {
                throw new Error('No documents loaded from repository');
            }
            // Update progress and start chunking - wrapped in try-catch since jobs were failing here
            logger.info(`📍 Step 3: Updating progress to 30% and starting chunking...`);
            try {
                await job.updateProgress(30);
                logger.debug(`✅ Progress updated to 30%`);
            }
            catch (progressError) {
                logger.error('❌ Failed to update progress to 30%', {
                    progressError,
                });
                throw new Error(`Progress update failed: ${progressError.message}`);
            }
            // Chunk documents with error handling
            let chunkedDocs;
            try {
                logger.info('🔄 Starting to chunk documents...');
                chunkedDocs = await chunkDocuments(bigDocs);
                logger.info(`✅ Chunked into ${chunkedDocs.length} documents`);
            }
            catch (chunkError) {
                logger.error('❌ Error during chunking', { chunkError });
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
            logger.info(`📊 Total documents to process: ${total}`);
            await job.updateProgress(36);
            // Batch processing: Instead of processing one document at a time (slow and expensive),
            // we process 50 documents together. This is much faster and reduces API costs.
            // Processing 5 batches at the same time speeds things up even more.
            const BATCH_SIZE = 50; // Documents per batch
            const CONCURRENT_BATCHES = 5; // How many batches to process simultaneously
            // Process a batch of documents together (faster than one-by-one)
            const processBatch = async (batch, batchIndex) => {
                try {
                    logger.info(`🔄 Processing batch ${batchIndex + 1} with ${batch.length} documents`);
                    await upsert(batch);
                    logger.info(`✅ Completed batch ${batchIndex + 1}`);
                    return batch.length;
                }
                catch (error) {
                    logger.error(`❌ Failed to process batch ${batchIndex + 1}`, {
                        error,
                    });
                    throw error;
                }
            };
            // Split all documents into smaller batches
            const batches = [];
            for (let i = 0; i < total; i += BATCH_SIZE) {
                batches.push(chunkedDocs.slice(i, i + BATCH_SIZE));
            }
            logger.info(`📦 Split into ${batches.length} batches of up to ${BATCH_SIZE} documents each`);
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
                logger.debug(`📈 Progress: ${processedCount}/${total} documents (${percentage}%)`);
                await job.updateProgress(percentage);
            }
            logger.info(`🎉 Successfully processed all ${total} documents!`);
        }
        catch (error) {
            // Log full error details before re-throwing
            logger.error('❌ Job failed with error', { error, stack: error?.stack });
            throw error; // Re-throw to mark job as failed
        }
    }, {
        connection: redisClient,
    })
        // Worker event listeners for visibility into worker lifecycle
        .on('ready', () => {
        logger.info('✅ BullMQ Worker is ready and listening for jobs');
    })
        .on('active', (job) => {
        logger.info(`🟢 Worker: Job ${job.id} is now active`);
    })
        .on('completed', (job) => {
        logger.info(`✅ Job ${job.id} has completed!`);
    })
        .on('failed', (job, err) => {
        // Enhanced error logging for failed jobs
        logger.error('❌❌❌ JOB FAILED ❌❌❌', {
            jobId: job?.id,
            message: err.message,
            name: err.name,
            stack: err.stack,
        });
    })
        .on('error', (err) => {
        // Catch worker-level errors (Redis connection issues, etc.)
        logger.error('❌ Worker error', { err });
    });
    logger.info('✅ BullMQ Worker created and configured');
}
catch (workerError) {
    // Log error but don't crash server - worker will just not be available
    logger.error('❌❌❌ Failed to create BullMQ worker!', {
        workerError,
        stack: workerError?.stack,
    });
    logger.warn('⚠️ Server will continue but jobs will not be processed');
    // Don't re-throw - let server start even if worker fails
}
