import IORedis from 'ioredis';
import { Worker, Queue, Job } from 'bullmq';
import { cloneRepo } from './git.service.js';
import { TsmorphCodeLoader } from './loader.service.js';
import { chunkDocuments } from './chunk.service.js';
import { upsert } from './vector.service.js';

console.log('🔍 REDIS_URL:', process.env.REDIS_URL);

const redisClient = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

export const indexQueue = new Queue('index', {
  connection: redisClient,
});

const worker = new Worker(
  'index',
  async (job: Job<{ repoUrl: string; sha: string }>) => {
    // CHANGE: Added try-catch wrapper for better error handling
    try {
      const { repoUrl, sha } = job.data;

      const { localRepoPath, repoId } = await cloneRepo(repoUrl, sha);
      await job.updateProgress(15);

      const loader = new TsmorphCodeLoader(localRepoPath, repoId);
      const bigDocs = await loader.load();
      
      // CHANGE: Added logging and validation for loaded documents
      console.log(`📄 Loaded ${bigDocs?.length || 0} documents`);
      
      // Validate bigDocs before chunking
      if (!bigDocs || !Array.isArray(bigDocs)) {
        throw new Error(`Invalid documents array: ${typeof bigDocs}`);
      }
      
      if (bigDocs.length === 0) {
        throw new Error('No documents loaded from repository');
      }

      await job.updateProgress(30);

      // CHANGE: Added error handling around chunkDocuments call
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

      // CHANGE: Added error handling around upsert operations
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
      // CHANGE: Added comprehensive error logging
      console.error('❌ Job failed with error:', error);
      console.error('Error stack:', error.stack);
      throw error; // Re-throw to mark job as failed
    }
  },
  {
    connection: redisClient,
  }
)
  .on('completed', (job) => {
    console.log(`${job.id} has completed!`);
  })
  .on('failed', (job, err) => {
    // CHANGE: Enhanced error logging in failed handler
    console.error(`❌ Job ${job?.id} has failed with error:`, err.message);
    console.error('Full error:', err);
  });
