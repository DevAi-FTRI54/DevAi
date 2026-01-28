import { indexQueue } from './index.job.js';
import { logger } from '../../utils/logger.js';
// // Local testing for GitHub repo indexing
// export const indexRepoOld = (req: Request, res: Response) => {
//   const { repoUrl, sha = 'HEAD' } = req.body;
//   cloneRepo(repoUrl, sha)
//     .then((localRepoPath) => localRepoPath)
//     .catch((err) => err);
//   res.json({ status: 'indexing-started' });
// };
// Using BullMQ Queue & Worker
export const indexRepo = async (req, res) => {
    const { repoUrl, sha = 'HEAD' } = req.body;
    logger.info('indexRepo requested', { repoUrl, sha });
    const job = await indexQueue.add('index', { repoUrl, sha });
    logger.debug('Index job enqueued', {
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
export const getJobStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const job = await indexQueue.getJob(id);
        if (!job) {
            res.status(404).json({ error: 'Job not found' });
            return;
        }
        const state = await job.getState();
        const progress = job.progress || 0;
        // Get the error message if job failed - check multiple places where BullMQ might store it
        let failedReason = null;
        if (state === 'failed') {
            try {
                const jobData = job;
                // Log what properties the job has so we can see what's available
                logger.warn('Job failed - inspecting BullMQ job object', {
                    jobId: job.id,
                    keys: Object.keys(jobData),
                    failedReason: jobData.failedReason,
                    returnvalue: jobData.returnvalue,
                    opts: jobData.opts,
                });
                // Try to get error from different possible locations
                if (jobData.failedReason) {
                    failedReason = jobData.failedReason;
                }
                else if (jobData.returnvalue) {
                    const returnValue = jobData.returnvalue;
                    if (returnValue && typeof returnValue === 'object' && returnValue.message) {
                        failedReason = returnValue.message;
                    }
                    else {
                        failedReason = String(returnValue);
                    }
                }
                logger.warn('Extracted failed reason', { failedReason });
            }
            catch (err) {
                logger.error('Error getting failed reason', { err });
            }
        }
        const jobProgress = {
            id: job.id,
            status: state,
            progress,
            data: job.data,
            failedReason, // Send error message to frontend
        };
        logger.debug('Job progress', jobProgress);
        res.json({
            id: job.id,
            status: state,
            progress,
            data: job.data,
            failedReason, // Include error message in response
        });
    }
    catch (error) {
        logger.error('Error getting job status', { error });
        res.status(500).json({ error: 'Failed to get job status' });
    }
};
