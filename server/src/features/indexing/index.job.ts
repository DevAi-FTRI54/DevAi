import { Worker, Queue, Job } from 'bullmq';
import { cloneRepo } from './git.service.js';
import { TsmorphCodeLoader } from './loader.service.js';
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
  async (job: Job<{ repoUrl: string; sha: string }>) => {
    const { repoUrl, sha } = job.data;
    // console.log('\n--- job.data ------');
    // console.log(job.data);

    const { localRepoPath, repoId } = await cloneRepo(repoUrl, sha);
    await job.updateProgress(15);

    const loader = new TsmorphCodeLoader(localRepoPath, repoId);
    const bigDocs = await loader.load();
    console.log('bigDocs', bigDocs);
    await job.updateProgress(30);

    const chunkedDocs = (await chunkDocuments(bigDocs))
      .filter((d) => d.pageContent && d.pageContent.trim().length > 0)
      .filter((d) => d.pageContent.length < 4 * 1024 * 4); // ~16 kB ≈ 8 k tokens safety

    const total = chunkedDocs.length;
    console.log('total: ', total);

    for (let i = 0; i < total; i++) {
      await upsert([chunkedDocs[i]]);
      const percentage = 36 + Math.floor(((i + 1) / total) * 64);
      console.log('--- chunkedDocs[0] ---------');
      console.log(chunkedDocs[i]);
      await job.updateProgress(percentage);
    }
  },
  { connection: redisOptions }
)
  .on('completed', (job) => {
    console.log(`${job.id} has completed!`);
  })
  .on('failed', (job, err) => {
    console.log(`${job!.id} has failed with ${err.message}`);
  });
