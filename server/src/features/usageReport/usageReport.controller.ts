import { Request, Response } from 'express';
import { writeUsageReportToFile } from '../../utils/usageReport.js';

/**
 * GET /api/usage-report
 * Builds usage report from Conversation + User (past and current data), writes to logs/usage-report.txt, returns content.
 * Requires auth (requireAuth middleware).
 */
export async function getUsageReport(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const content = await writeUsageReportToFile();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } catch (err: any) {
    console.error('Usage report failed:', err);
    res
      .status(500)
      .json({
        error: 'Failed to generate usage report',
        message: err?.message,
      });
  }
}
