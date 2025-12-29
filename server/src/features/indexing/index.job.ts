// Log when worker file loads so we can verify it's being imported
console.log('========================================');
console.log('WORKER FILE: index.job.ts LOADED');
console.log('========================================');

import IORedis from 'ioredis';
import { Worker, Queue, Job } from 'bullmq';
import { cloneRepo } from './git.service.js';
import { TsmorphCodeLoader } from './loader.service.js';
import { chunkDocuments } from './chunk.service.js';
import { upsert } from './vector.service.js';

console.log('🔍 REDIS_URL:', process.env.REDIS_URL ? 'Set' : 'Missing');
console.log('🚀 Initializing BullMQ worker...');

// Create Redis client - use lazy connect so it doesn't block server startup
let redisClient: IORedis;
if (!process.env.REDIS_URL) {
  console.error('⚠️ REDIS_URL not set - worker will not function');
  // Create a dummy client that will fail gracefully
  redisClient = new IORedis('redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    retryStrategy: () => null, // Don't retry if connection fails
  });
} else {
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

// Create worker - wrap in try-catch so errors don't crash server startup
let worker;
try {
  console.log('🔧 Creating BullMQ worker...');
  worker = new Worker(
  'index',
  async (job: Job<{ repoUrl: string; sha: string }>) => {
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
      } catch (progressError: any) {
        console.error('❌ Failed to update progress to 30%:', progressError);
        throw new Error(`Progress update failed: ${progressError.message}`);
      }

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

      // Split all documents into smaller batches
      const batches = [];
      for (let i = 0; i < total; i += BATCH_SIZE) {
        batches.push(chunkedDocs.slice(i, i + BATCH_SIZE));
      }

      console.log(
        `📦 Split into ${batches.length} batches of up to ${BATCH_SIZE} documents each`
      );

      // Process multiple batches at the same time for speed
      // This processes CONCURRENT_BATCHES batches simultaneously instead of waiting for each one
      let processedCount = 0;
      const progressRange = 64; // Progress from 36% to 100%

      for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
        // Process CONCURRENT_BATCHES batches at once
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

      console.log(`🎉 Successfully processed all ${total} documents!`);
    } catch (error: any) {
      // Log full error details before re-throwing
      console.error('❌ Job failed with error:', error);
      console.error('Error stack:', error.stack);
      throw error; // Re-throw to mark job as failed
    }
  },
  {
    connection: redisClient,
  }
)
  // Worker event listeners for visibility into worker lifecycle
  .on('ready', () => {
    console.log('✅ BullMQ Worker is ready and listening for jobs');
  })
  .on('active', (job) => {
    console.log(`🟢 Worker: Job ${job.id} is now active`);
  })
  .on('completed', (job) => {
    console.log(`✅ Job ${job.id} has completed!`);
  })
  .on('failed', (job, err) => {
    // Enhanced error logging for failed jobs
    console.error(`\n❌❌❌ JOB FAILED ❌❌❌`);
    console.error(`Job ID: ${job?.id}`);
    console.error(`Error message: ${err.message}`);
    console.error(`Error name: ${err.name}`);
    console.error(`Full error object:`, err);
    if (err.stack) {
      console.error(`Error stack:\n${err.stack}`);
    }
  })
  .on('error', (err) => {
    // Catch worker-level errors (Redis connection issues, etc.)
    console.error('❌ Worker error:', err);
  });
  
  console.log('✅ BullMQ Worker created and configured');
} catch (workerError: any) {
  // Log error but don't crash server - worker will just not be available
  console.error('❌❌❌ Failed to create BullMQ worker!');
  console.error('Worker creation error:', workerError);
  console.error('Error stack:', workerError.stack);
  console.error('⚠️ Server will continue but jobs will not be processed');
  // Don't re-throw - let server start even if worker fails
}
