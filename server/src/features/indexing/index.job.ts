import IORedis from 'ioredis';
import { Worker, Queue, Job } from 'bullmq';
import { cloneRepo } from './git.service.js';
import { TsmorphCodeLoader } from './loader.service.js';
import { chunkDocuments } from './chunk.service.js';
import { upsert } from './vector.service.js';

console.log('🔍 REDIS_URL:', process.env.REDIS_URL);
console.log('🚀 Initializing BullMQ worker...');

const redisClient = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

export const indexQueue = new Queue('index', {
  connection: redisClient,
});

console.log('✅ Index queue created');

// Wrap worker creation in try-catch to catch initialization errors
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

      // Upsert each document with error handling to identify which one fails
      for (let i = 0; i < total; i++) {
        try {
          await upsert([chunkedDocs[i]]);
          const percentage = 36 + Math.floor(((i + 1) / total) * 64);
          await job.updateProgress(percentage);
        } catch (upsertError: any) {
          console.error(`❌ Failed to upsert document ${i + 1}/${total}:`, upsertError);
          throw new Error(`Failed to upsert document: ${upsertError.message}`);
        }
      }
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
  // If worker creation fails, log and re-throw to prevent silent failures
  console.error('❌❌❌ CRITICAL: Failed to create BullMQ worker!');
  console.error('Worker creation error:', workerError);
  console.error('Error stack:', workerError.stack);
  throw workerError;
}
