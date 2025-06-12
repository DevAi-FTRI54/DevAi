import { Worker, Queue, Job } from 'bullmq';
import { cloneRepo } from './git.service.js';
import { TsmorphCodeLoader } from './loader.service.js';
import { GitHubApiService } from './github-api.service.js';
import { InMemoryCodeLoader } from './memory-loader.service.js';
import { chunkDocuments } from './chunk.service.js';
import { upsert } from './vector.service.js';

/**
 * ## Resources =>
 * https://docs.bullmq.io/guide/telemetry/running-a-simple-example
 * https://betterstack.com/community/guides/scaling-nodejs/bullmq-scheduled-tasks/
 *
 * ## indexRepo =>
 * 1/ Clone repo [done]
 * 2/ Load repo (ts-morph) [done]
 * 3/ Chunk it down - RecursiveChunkSplitter [done]
 * 4/ Turn it into vector embeddings (LangChain) [done]
 * 5/ Upsert [done]
 *
 * ## query =>
 * 6/ Receive Query from the User
 * 7/ Retrieve relevant docs
 * 8/ rerank [wed]
 * 9/ Run eval scripts (LangSmith) [thu] -> should be easy
 * 10/ Log costs/latency [thu] -> should be easy
 */

const redisOptions = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
};

export const indexQueue = new Queue('index', { connection: redisOptions });

// --- Worker ------------------------------------------------------------
const worker = new Worker(
  'index',
  async (job: Job<{ repoUrl: string; sha: string; accessToken?: string }>) => {
    const { repoUrl, sha, accessToken } = job.data;
    
    console.log(`🚀 Starting indexing for ${repoUrl}`);

    let bigDocs;
    let repoId;
    let repoName;

    if (accessToken) {
      // PREFERRED: Use GitHub API (faster, no file system dependencies)
      console.log('📡 Using GitHub API approach');
      
      try {
        const githubService = new GitHubApiService(accessToken);
        const { files, repoId: apiRepoId } = await githubService.fetchRepositoryContent(repoUrl, sha);
        
        repoId = apiRepoId;
        repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'unknown';
        
        await job.updateProgress(15);

        const loader = new InMemoryCodeLoader(files, repoId, repoName);
        bigDocs = await loader.load();
        
        console.log(`📄 Loaded ${bigDocs.length} documents via GitHub API`);
      } catch (error) {
        console.error('❌ GitHub API failed, falling back to local clone:', error);
        // Fallback to local approach if GitHub API fails
        const { localRepoPath, repoId: localRepoId } = await cloneRepo(repoUrl, sha);
        repoId = localRepoId;
        repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'unknown';
        
        await job.updateProgress(15);

        const loader = new TsmorphCodeLoader(localRepoPath, repoId);
        bigDocs = await loader.load();
        
        console.log(`📄 Loaded ${bigDocs.length} documents via fallback local clone`);
      }
    } else {
      // FALLBACK: Use local cloning (when no access token available)
      console.log('💻 Using local clone approach (no access token available)');
      
      const { localRepoPath, repoId: localRepoId } = await cloneRepo(repoUrl, sha);
      repoId = localRepoId;
      repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'unknown';
      
      await job.updateProgress(15);

      const loader = new TsmorphCodeLoader(localRepoPath, repoId);
      bigDocs = await loader.load();
      
      console.log(`📄 Loaded ${bigDocs.length} documents via local clone`);
    }

    await job.updateProgress(30);

    const chunkedDocs = (await chunkDocuments(bigDocs)).map((doc) => {
      // If the document is empty, write into the pageContent that it's empty
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

    // Batch processing configuration
    const BATCH_SIZE = 10; // Process 10 documents per batch
    const CONCURRENT_BATCHES = 3; // Process 3 batches concurrently

    // Helper function to process a batch of documents
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
    const progressRange = 64; // Progress from 36% to 100%

    for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
      const currentBatches = batches.slice(i, i + CONCURRENT_BATCHES);

      // Process current set of batches concurrently
      const results = await Promise.all(
        currentBatches.map((batch, index) => processBatch(batch, i + index))
      );

      // Update progress
      processedCount += results.reduce((sum, count) => sum + count, 0);
      const percentage =
        36 + Math.floor((processedCount / total) * progressRange);

      console.log(
        `📈 Progress: ${processedCount}/${total} documents (${percentage}%)`
      );
      await job.updateProgress(percentage);
    }

    console.log(`🎉 Successfully processed all ${total} documents!`);
  },
  { connection: redisOptions }
)
  .on('completed', (job) => {
    console.log(`${job.id} has completed!`);
  })
  .on('failed', (job, err) => {
    console.log(`${job!.id} has failed with ${err.message}`);
  });
