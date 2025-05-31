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
  console.log('\n--- indexRepo ------');
  console.log('repoUrl: ', repoUrl);
  console.log('sha: ', sha);

  const job = await indexQueue.add('index', { repoUrl, sha });
  console.log('--- SENDING TO THE FRONTEND ------------');
  console.log({
    jobId: job.id,
    repoUrl: repoUrl,
    message: 'Repository ingestion started',
  });
  res.json({
    jobId: job.id,
    repoUrl: repoUrl,
    message: 'Repository ingestion started',
  });
};

export const getJobStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const job = await indexQueue.getJob(id);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const state = await job.getState();
    const progress = job.progress || 0;
    const jobProgress = {
      id: job.id,
      status: state,
      progress,
      data: job.data,
    };
    console.log('--- jobProgress ---------');
    console.log(jobProgress);

    res.json({
      id: job.id,
      status: state,
      progress,
      data: job.data,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get job status' });
  }
};
