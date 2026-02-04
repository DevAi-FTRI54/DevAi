// Lazy load index.job so app can listen and respond 200 to keep-alive before heavy deps load.
// That lets Render/UptimeRobot get a successful response and prevents the service from being
// treated as asleep (503). Worker loads in background after listen or on first /ingest.
let _indexQueue = null;
async function getIndexQueue() {
    if (!_indexQueue) {
        const m = await import('./index.job.js');
        _indexQueue = m.indexQueue;
    }
    return _indexQueue;
}
// Using BullMQ Queue & Worker
export const indexRepo = async (req, res) => {
    const { repoUrl, sha = 'HEAD' } = req.body;
    console.log('\n--- indexRepo ------');
    console.log('repoUrl: ', repoUrl);
    console.log('sha: ', sha);
    const indexQueue = await getIndexQueue();
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
export const getJobStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const indexQueue = await getIndexQueue();
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
                console.log('--- JOB FAILED - Inspecting job object ---');
                console.log('Job keys:', Object.keys(jobData));
                console.log('Job failedReason property:', jobData.failedReason);
                console.log('Job returnvalue:', jobData.returnvalue);
                console.log('Job opts:', jobData.opts);
                // Try to get error from different possible locations
                if (jobData.failedReason) {
                    failedReason = jobData.failedReason;
                }
                else if (jobData.returnvalue) {
                    const returnValue = jobData.returnvalue;
                    if (returnValue &&
                        typeof returnValue === 'object' &&
                        returnValue.message) {
                        failedReason = returnValue.message;
                    }
                    else {
                        failedReason = String(returnValue);
                    }
                }
                console.log('Extracted failed reason:', failedReason);
            }
            catch (err) {
                console.error('Error getting failed reason:', err);
            }
        }
        const jobProgress = {
            id: job.id,
            status: state,
            progress,
            data: job.data,
            failedReason, // Send error message to frontend
        };
        console.log('--- jobProgress ---------');
        console.log(jobProgress);
        res.json({
            id: job.id,
            status: state,
            progress,
            data: job.data,
            failedReason, // Include error message in response
        });
    }
    catch (error) {
        console.error('Error getting job status:', error);
        res.status(500).json({ error: 'Failed to get job status' });
    }
};
