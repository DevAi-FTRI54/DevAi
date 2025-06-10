import IORedis from 'ioredis';
import { Queue } from 'bullmq';
const redisClient = new IORedis(process.env.REDIS_URL);
export const indexQueue = new Queue('index', {
    connection: redisClient,
});
// const worker = new Worker(
//   'index',
//   async (job: Job<{ repoUrl: string; sha: string }>) => {
//     const { repoUrl, sha } = job.data;
//     const { localRepoPath, repoId } = await cloneRepo(repoUrl, sha);
//     await job.updateProgress(15);
//     const loader = new TsmorphCodeLoader(localRepoPath, repoId);
//     const bigDocs = await loader.load();
//     await job.updateProgress(30);
//     const chunkedDocs = (await chunkDocuments(bigDocs)).map((doc) => {
//       if (!doc.pageContent || doc.pageContent.trim().length === 0) {
//         return {
//           ...doc,
//           pageContent: 'Empty file',
//           metaData: {
//             ...doc.metadata,
//             isEmpty: true,
//           },
//         };
//       }
//       return doc;
//     });
//     const total = chunkedDocs.length;
//     console.log('total: ', total);
//     for (let i = 0; i < total; i++) {
//       await upsert([chunkedDocs[i]]);
//       const percentage = 36 + Math.floor(((i + 1) / total) * 64);
//       await job.updateProgress(percentage);
//     }
//   },
//   {
//     connection: redisClient,
//   }
// )
//   .on('completed', (job) => {
//     console.log(`${job.id} has completed!`);
//   })
//   .on('failed', (job, err) => {
//     console.log(`${job?.id} has failed with ${err.message}`);
//   });
