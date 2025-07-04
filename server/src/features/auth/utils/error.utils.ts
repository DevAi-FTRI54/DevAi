import { Response } from 'express';

// Custom error for GitHub API failures
export class GitHubApiError extends Error {
  status: number;
  details?: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.details = details;
  }
}

// Handle API errors consistently
export function handleApiError(
  error: any,
  res: Response,
  context: string = 'API error'
): void {
  console.error(`❌ ${context}:`, error);

  // Check if response was already sent
  if (res.headersSent) {
    return;
  }

  const status = error.status || error.statusCode || 500;
  if (error instanceof GitHubApiError) {
    res.status(502).json({
      error: 'GitHub API Error',
      message: error.message,
      status: error.status,
      details: error.details,
    });
    return;
  }

  res.status(status).json({
    error: 'Server Error',
    message: error.message || 'An unexpected error occurred',
  });
}
