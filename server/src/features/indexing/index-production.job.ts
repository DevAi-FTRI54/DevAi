// Production-ready indexing job that works without local file cloning
import { Worker, Queue, Job } from 'bullmq';
import { cloneRepo } from './git.service.js';
import { TsmorphCodeLoader } from './loader.service.js';
import { GitHubApiService } from './github-api.service.js';
import { InMemoryCodeLoader } from './memory-loader.service.js';
import { chunkDocuments } from './chunk.service.js';
import { upsert } from './vector.service.js';

const redisOptions = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
};

export const indexQueue = new Queue('index', { connection: redisOptions });

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
const isRenderDeployment = !!process.env.RENDER;

// Indexing method selection - prefer GitHub API when:
// 1. USE_LOCAL_MODEL is 'false' (your current setting), OR
// 2. We're in production environment, OR
// 3. We're deployed on Render, OR
// 4. Default to GitHub API for better reliability
const preferGitHubAPI =
  process.env.USE_LOCAL_MODEL === 'false' ||
  isProduction ||
  isRenderDeployment ||
  true; // Default to GitHub API

console.log(
  `🔧 Indexing mode: ${
    preferGitHubAPI ? 'GitHub API (Octokit)' : 'Local Clone'
  }`
);
console.log(`🏗️ Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`📍 Platform: ${isRenderDeployment ? 'Render' : 'Local/Other'}`);
console.log(
  `⚙️ USE_LOCAL_MODEL: ${process.env.USE_LOCAL_MODEL || 'undefined'}`
);

// --- Worker ------------------------------------------------------------
const worker = new Worker(
  'index',
  async (job: Job<{ repoUrl: string; sha: string; accessToken?: string }>) => {
    const { repoUrl, sha, accessToken } = job.data;

    console.log(`🚀 Starting indexing job for ${repoUrl}`);
    console.log(
      `🔧 Method: ${
        preferGitHubAPI && accessToken ? 'GitHub API' : 'Local Clone'
      }`
    );

    let bigDocs;
    let repoId;
    let repoName;

    if (preferGitHubAPI && accessToken) {
      // GITHUB API: Use Octokit (preferred method)
      console.log('📡 Using GitHub API approach (Octokit)');

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
      // FALLBACK: Use local cloning (when no access token or explicitly requested)
      const reason = !accessToken
        ? 'no access token available'
        : 'local mode requested';
      console.log(`💻 Using local clone approach (${reason})`);

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

    await job.updateProgress(30);

    // Rest of the processing is the same for both approaches
    const chunkedDocs = (await chunkDocuments(bigDocs)).map((doc) => {
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

    // Batch processing configuration
    const BATCH_SIZE = 10;
    const CONCURRENT_BATCHES = 3;

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
  },
  { connection: redisOptions }
)
  .on('completed', (job) => {
    console.log(`${job.id} has completed!`);
  })
  .on('failed', (job, err) => {
    console.log(`${job!.id} has failed with ${err.message}`);
  });
