import express, { Request, Response } from 'express';
import { cloneRepo } from './git.service.js';
import { indexQueue } from './index.job.js';

// // Local testing for GitHub repo indexing
// export const indexRepoOld = (req: Request, res: Response) => {
//   const { repoUrl, sha = 'HEAD' } = req.body;

//   cloneRepo(repoUrl, sha)
//     .then((localRepoPath) => console.log('repo path:', localRepoPath))
//     .catch((err) => console.error('repo clone failed:', err));

//   res.json({ status: 'indexing-started' });
// };

// Using BullMQ Queue & Worker
export const indexRepo = async (req: Request, res: Response) => {
  const { repoUrl, sha = 'HEAD' } = req.body;
  // console.log('\n--- indexRepo ------');
  // console.log('repoUrl: ', repoUrl);
  // console.log('sha: ', sha);

  const job = await indexQueue.add('index', { repoUrl, sha });
  console.log('✅ Repo indexed successfully.');
  res.json({ jobId: job.id });
};
