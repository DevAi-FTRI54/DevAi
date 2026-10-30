import { indexQueue } from './index-production.job.js';
// Using BullMQ Queue & Worker with production support
export const indexRepo = async (req, res) => {
    const { repoUrl, sha = 'HEAD' } = req.body;
    console.log('\n--- indexRepo (Production Ready) ------');
    console.log('repoUrl:', repoUrl);
    console.log('sha:', sha);
    // Get GitHub access token from cookies (for production GitHub API access)
    const accessToken = req.cookies?.github_access_token;
    if (process.env.NODE_ENV === 'production' && !accessToken) {
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
        console.log('--- Job Created Successfully ------');
        console.log({
            jobId: job.id,
            repoUrl,
            environment: process.env.NODE_ENV || 'development',
            useGitHubAPI: !!accessToken,
        });
        res.json({
            jobId: job.id,
            repoUrl,
            message: 'Repository ingestion started',
            environment: process.env.NODE_ENV || 'development',
            method: accessToken ? 'GitHub API' : 'Local Clone',
        });
    }
    catch (error) {
        console.error('❌ Failed to create indexing job:', error);
        res.status(500).json({
            error: 'Failed to start repository indexing',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
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
        const jobProgress = {
            id: job.id,
            status: state,
            progress,
            data: job.data,
            environment: process.env.NODE_ENV || 'development',
        };
        console.log('--- Job Status ------');
        console.log(jobProgress);
        res.json(jobProgress);
    }
    catch (error) {
        console.error('❌ Failed to get job status:', error);
        res.status(500).json({
            error: 'Failed to get job status',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
