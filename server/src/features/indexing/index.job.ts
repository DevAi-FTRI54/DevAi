// Log when worker file loads so we can verify it's being imported
console.log('========================================');
console.log('WORKER FILE: index.job.ts LOADED');
console.log('========================================');

import { Redis } from 'ioredis';
import { Worker, Queue, Job } from 'bullmq';
import { cloneRepo } from './git.service.js';
import { TsmorphCodeLoader } from './loader.service.js';
import { chunkDocuments } from './chunk.service.js';
import { upsert } from './vector.service.js';

console.log('🔍 REDIS_URL:', process.env.REDIS_URL ? 'Set' : 'Missing');
console.log('🚀 Initializing BullMQ worker...');

// Create Redis client - use lazy connect so it doesn't block server startup
let redisClient: Redis;
if (!process.env.REDIS_URL) {
  console.error('⚠️ REDIS_URL not set - worker will not function');
  // Create a dummy client that will fail gracefully
  redisClient = new Redis('redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    retryStrategy: () => null, // Don't retry if connection fails
  });
} else {
  redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => {
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

// Don't create worker immediately - it causes memory issues
// Worker will be created lazily after a delay
let worker: Worker | null = null;

// Job processor function (extracted so it can be reused)
const processJob = async (job: Job<{ repoUrl: string; sha: string }>) => {
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
};

// Function to initialize worker lazily (only when needed)
export function initializeWorker(): Worker | null {
  if (worker) {
    return worker; // Already initialized
  }

  if (!process.env.REDIS_URL) {
    console.warn('⚠️ Cannot create worker: REDIS_URL not set');
    return null;
  }

  try {
    console.log('🔧 Creating BullMQ worker (lazy initialization)...');
    worker = new Worker('index', processJob, {
      connection: redisClient,
    })
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
    return worker;
  } catch (workerError: any) {
    // Log error but don't crash server - worker will just not be available
    console.error('❌❌❌ Failed to create BullMQ worker!');
    console.error('Worker creation error:', workerError);
    console.error('Error stack:', workerError.stack);
    console.error('⚠️ Server will continue but jobs will not be processed');
    return null;
  }
}

// Auto-initialize worker after a delay to avoid startup memory issues
// This gives the server time to start and Render to detect the port
setTimeout(() => {
  if (process.env.REDIS_URL) {
    console.log('⏰ Auto-initializing worker after startup delay...');
    initializeWorker();
  }
}, 10000); // Wait 10 seconds after module load
