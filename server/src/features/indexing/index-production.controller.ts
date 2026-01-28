// Production-ready indexing controller
import { Request, Response } from 'express';
import { indexQueue } from './index-production.job.js';
import { NODE_ENV } from '../../config/env.validation.js';
import { logger } from '../../utils/logger.js';

// Using BullMQ Queue & Worker with production support
export const indexRepo = async (req: Request, res: Response) => {
  const { repoUrl, sha = 'HEAD' } = req.body;

  logger.info('indexRepo requested', { repoUrl, sha });

  // Get GitHub access token from cookies (for production GitHub API access)
  const accessToken = req.cookies?.github_access_token;

  if (NODE_ENV === 'production' && !accessToken) {
    return res.status(401).json({
      error: 'GitHub access token required for production indexing',
      message: 'Please ensure you are logged in with GitHub',
    });
  }

  const jobData = {
    repoUrl,
    sha,
    ...(accessToken && { accessToken }), // Only include if available
  };

  try {
    const job = await indexQueue.add('index', jobData);

    logger.info('Index job created', {
      jobId: job.id,
      repoUrl,
      environment: NODE_ENV,
      useGitHubAPI: !!accessToken,
    });

    res.json({
      jobId: job.id,
      repoUrl,
      message: 'Repository ingestion started',
      environment: NODE_ENV,
      method: accessToken ? 'GitHub API' : 'Local Clone',
    });
  } catch (error) {
    logger.error('❌ Failed to create indexing job', { error });
    res.status(500).json({
      error: 'Failed to start repository indexing',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getJobStatus = async (
  req: Request,
  res: Response,
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
      environment: NODE_ENV,
    };

    logger.debug('Index job status', jobProgress as any);

    res.json(jobProgress);
  } catch (error) {
    logger.error('❌ Failed to get job status', { error });
    res.status(500).json({
      error: 'Failed to get job status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
