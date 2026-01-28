/**
 * Production Indexing Job Worker
 *
 * This is a production-optimized version of the indexing worker that uses GitHub API
 * to fetch files directly instead of cloning repositories locally. This is more efficient
 * for cloud deployments where we don't have persistent storage for cloned repos.
 *
 * The worker processes repository indexing jobs asynchronously, handling:
 * - Fetching repository files via GitHub API
 * - Loading and parsing code files
 * - Chunking code into semantic pieces
 * - Generating embeddings
 * - Storing in vector database
 */
import IORedis from 'ioredis';
import { Worker, Queue, Job } from 'bullmq';
import { cloneRepo } from './git.service.js';
import { TsmorphCodeLoader } from './loader.service.js';
import { GitHubApiService } from './github-api.service.js';
import { InMemoryCodeLoader } from './memory-loader.service.js';
import { chunkDocuments } from './chunk.service.js';
import { upsert } from './vector.service.js';
import { REDIS_URL, NODE_ENV } from '../../config/env.validation.js';
import { logger } from '../../utils/logger.js';

logger.info('🔍 REDIS_URL', { configured: !!REDIS_URL });

// Create Redis client with validated URL
const redisClient = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // BullMQ handles retries, not IORedis
});

export const indexQueue = new Queue('index', {
  connection: redisClient,
});

// Determine if we're in production or development
const isProduction = NODE_ENV === 'production';

// --- Worker ------------------------------------------------------------
// Production worker with error handling - supports both GitHub API and local cloning
const worker = new Worker(
  'index',
  async (job: Job<{ repoUrl: string; sha: string; accessToken?: string }>) => {
    // Wrap everything in try-catch to catch and log all errors
    try {
      const { repoUrl, sha, accessToken } = job.data;

      logger.info(`🚀 Starting indexing job for ${repoUrl}`, {
        environment: isProduction ? 'PRODUCTION' : 'DEVELOPMENT',
      });

      let bigDocs;
      let repoId;
      let repoName;

      if (isProduction && accessToken) {
        // PRODUCTION: Use GitHub API (no local cloning)
        logger.info('📡 Using GitHub API approach (production)');

        const githubService = new GitHubApiService(accessToken);
        const { files, repoId: apiRepoId } =
          await githubService.fetchRepositoryContent(repoUrl, sha);

        repoId = apiRepoId;
        repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'unknown';

        await job.updateProgress(15);

        const loader = new InMemoryCodeLoader(files, repoId, repoName);
        bigDocs = await loader.load();

        logger.info(`📄 Loaded ${bigDocs.length} documents via GitHub API`);
      } else {
        // DEVELOPMENT: Use local cloning (fallback)
        logger.info('💻 Using local clone approach (development)');

        const { localRepoPath, repoId: localRepoId } = await cloneRepo(
          repoUrl,
          sha,
        );
        repoId = localRepoId;
        repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'unknown';

        await job.updateProgress(15);

        const loader = new TsmorphCodeLoader(localRepoPath, repoId);
        bigDocs = await loader.load();

        logger.info(`📄 Loaded ${bigDocs.length} documents via local clone`);
      }

      // Validate documents before proceeding
      if (!bigDocs || !Array.isArray(bigDocs)) {
        throw new Error(`Invalid documents array: ${typeof bigDocs}`);
      }

      if (bigDocs.length === 0) {
        throw new Error('No documents loaded from repository');
      }

      await job.updateProgress(30);

      // Chunk documents with error handling
      let chunkedDocs;
      try {
        logger.info('🔄 Starting to chunk documents...');
        chunkedDocs = await chunkDocuments(bigDocs);
        logger.info(`✅ Chunked into ${chunkedDocs.length} documents`);
      } catch (chunkError: any) {
        logger.error('❌ Error during chunking', { chunkError });
        throw new Error(`Failed to chunk documents: ${chunkError.message}`);
      }

      // Rest of the processing is the same for both approaches
      chunkedDocs = chunkedDocs.map((doc) => {
        if (!doc.pageContent || doc.pageContent.trim().length === 0) {
          return {
            ...doc,
            pageContent: 'Empty file',
            metadata: {
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

      const processBatch = async (
        batch: typeof chunkedDocs,
        batchIndex: number,
      ) => {
        try {
          logger.info(
            `🔄 Processing batch ${batchIndex + 1} with ${batch.length} documents`,
          );
          await upsert(batch);
          logger.info(`✅ Completed batch ${batchIndex + 1}`);
          return batch.length;
        } catch (error) {
          logger.error(`❌ Failed to process batch ${batchIndex + 1}`, {
            error,
          });
          throw error;
        }
      };

      // Split documents into batches
      const batches = [];
      for (let i = 0; i < total; i += BATCH_SIZE) {
        batches.push(chunkedDocs.slice(i, i + BATCH_SIZE));
      }

      logger.info(
        `📦 Split into ${batches.length} batches of up to ${BATCH_SIZE} documents each`,
      );

      // Process multiple batches at the same time for speed
      // This processes CONCURRENT_BATCHES batches simultaneously instead of waiting for each one
      let processedCount = 0;
      const progressRange = 64; // Progress from 36% to 100%

      for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
        // Process CONCURRENT_BATCHES batches at once
        const currentBatches = batches.slice(i, i + CONCURRENT_BATCHES);

        const results = await Promise.all(
          currentBatches.map((batch, index) => processBatch(batch, i + index)),
        );

        processedCount += results.reduce((sum, count) => sum + count, 0);
        const percentage =
          36 + Math.floor((processedCount / total) * progressRange);

        logger.debug(
          `📈 Progress: ${processedCount}/${total} documents (${percentage}%)`,
        );
        await job.updateProgress(percentage);
      }

      logger.info(
        `🎉 Successfully processed all ${total} documents for ${repoName}!`,
      );
    } catch (error: any) {
      // Log full error details before re-throwing
      logger.error('❌ Job failed with error', { error, stack: error?.stack });
      throw error; // Re-throw to mark job as failed
    }
  },
)
  .on('completed', (job) => {
    logger.info(`${job.id} has completed!`);
  })
  .on('failed', (job, err) => {
    // Enhanced error logging for failed jobs
    logger.error(`❌ Job ${job?.id} has failed`, {
      message: err.message,
      err,
      stack: err.stack,
    });
  });
