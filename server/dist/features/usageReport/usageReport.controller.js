import { writeUsageReportToFile, readQueryLog, } from '../../utils/usageReport.js';
/**
 * GET /api/usage-report
 * Builds usage report from Conversation + User (past and current data), writes to logs/usage-report.txt, returns content.
 * Requires auth (requireAuth middleware).
 */
export async function getUsageReport(req, res) {
    try {
        const content = await writeUsageReportToFile();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(content);
    }
    catch (err) {
        console.error('Usage report failed:', err);
        res.status(500).json({
            error: 'Failed to generate usage report',
            message: err?.message,
        });
    }
}
/**
 * GET /api/usage-report/query-log
 * Returns the contents of the repo-query log (same as server/logs/query-log.txt).
 * Use this when the app runs on Render so you can view the log in the browser.
 * Requires auth.
 */
export function getQueryLog(req, res) {
    const content = readQueryLog();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (content === null) {
        res
            .status(404)
            .send('No query log yet. Make a repo query in the app first.');
        return;
    }
    res.send(content);
}
