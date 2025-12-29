// Production-ready indexing job that works without local file cloning
import IORedis from 'ioredis';
import { Worker, Queue, Job } from 'bullmq';
import { cloneRepo } from './git.service.js';
import { TsmorphCodeLoader } from './loader.service.js';
import { GitHubApiService } from './github-api.service.js';
import { InMemoryCodeLoader } from './memory-loader.service.js';
import { chunkDocuments } from './chunk.service.js';
import { upsert } from './vector.service.js';

console.log('🔍 REDIS_URL:', process.env.REDIS_URL);

const redisClient = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

export const indexQueue = new Queue('index', {
  connection: redisClient,
});

// Determine if we're in production or development
const isProduction =
  process.env.NODE_ENV === 'production' || process.env.RENDER;

// --- Worker ------------------------------------------------------------
// Production worker with error handling - supports both GitHub API and local cloning
const worker = new Worker(
  'index',
  async (job: Job<{ repoUrl: string; sha: string; accessToken?: string }>) => {
    // Wrap everything in try-catch to catch and log all errors
    try {
      const { repoUrl, sha, accessToken } = job.data;

      console.log(`🚀 Starting indexing job for ${repoUrl}`);
      console.log(
        `🏗️ Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`
      );

      let bigDocs;
      let repoId;
      let repoName;

      if (isProduction && accessToken) {
        // PRODUCTION: Use GitHub API (no local cloning)
        console.log('📡 Using GitHub API approach (production)');

        const githubService = new GitHubApiService(accessToken);
        const { files, repoId: apiRepoId } =
          await githubService.fetchRepositoryContent(repoUrl, sha);

        repoId = apiRepoId;
        repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'unknown';

        await job.updateProgress(15);

        const loader = new InMemoryCodeLoader(files, repoId, repoName);
        bigDocs = await loader.load();

        console.log(`📄 Loaded ${bigDocs.length} documents via GitHub API`);
      } else {
        // DEVELOPMENT: Use local cloning (fallback)
        console.log('💻 Using local clone approach (development)');

        const { localRepoPath, repoId: localRepoId } = await cloneRepo(
          repoUrl,
          sha
        );
        repoId = localRepoId;
        repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'unknown';

        await job.updateProgress(15);

        const loader = new TsmorphCodeLoader(localRepoPath, repoId);
        bigDocs = await loader.load();

        console.log(`📄 Loaded ${bigDocs.length} documents via local clone`);
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
        console.log('🔄 Starting to chunk documents...');
        chunkedDocs = await chunkDocuments(bigDocs);
        console.log(`✅ Chunked into ${chunkedDocs.length} documents`);
      } catch (chunkError: any) {
        console.error('❌ Error during chunking:', chunkError);
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
      console.log(`📊 Total documents to process: ${total}`);
      await job.updateProgress(36);

      // Batch processing configuration - optimized for speed and cost
      // OpenAI embeddings API supports up to 2048 inputs per request
      // Using 50 per batch for good balance of speed and error handling
      const BATCH_SIZE = 50;
      const CONCURRENT_BATCHES = 5; // Process 5 batches concurrently for speed

      const processBatch = async (
        batch: typeof chunkedDocs,
        batchIndex: number
      ) => {
        try {
          console.log(
            `🔄 Processing batch ${batchIndex + 1} with ${batch.length} documents`
          );
          await upsert(batch);
          console.log(`✅ Completed batch ${batchIndex + 1}`);
          return batch.length;
        } catch (error) {
          console.error(`❌ Failed to process batch ${batchIndex + 1}:`, error);
          throw error;
        }
      };

      // Split documents into batches
      const batches = [];
      for (let i = 0; i < total; i += BATCH_SIZE) {
        batches.push(chunkedDocs.slice(i, i + BATCH_SIZE));
      }

      console.log(
        `📦 Split into ${batches.length} batches of up to ${BATCH_SIZE} documents each`
      );

      // Process batches with limited concurrency
      let processedCount = 0;
      const progressRange = 64;

      for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
        const currentBatches = batches.slice(i, i + CONCURRENT_BATCHES);

        const results = await Promise.all(
          currentBatches.map((batch, index) => processBatch(batch, i + index))
        );

        processedCount += results.reduce((sum, count) => sum + count, 0);
        const percentage =
          36 + Math.floor((processedCount / total) * progressRange);

        console.log(
          `📈 Progress: ${processedCount}/${total} documents (${percentage}%)`
        );
        await job.updateProgress(percentage);
      }

      console.log(
        `🎉 Successfully processed all ${total} documents for ${repoName}!`
      );
    } catch (error: any) {
      // Log full error details before re-throwing
      console.error('❌ Job failed with error:', error);
      console.error('Error stack:', error.stack);
      throw error; // Re-throw to mark job as failed
    }
  }
)
  .on('completed', (job) => {
    console.log(`${job.id} has completed!`);
  })
  .on('failed', (job, err) => {
    // Enhanced error logging for failed jobs
    console.error(`❌ Job ${job?.id} has failed with error:`, err.message);
    console.error('Full error:', err);
  });
