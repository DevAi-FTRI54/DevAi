/**
 * Query Request Validators
 *
 * These Zod schemas validate request bodies for the query endpoints.
 * They ensure we always have the minimum required shape before we start
 * streaming SSE responses or writing to Mongo.
 */
import { z } from 'zod';
export const askQuestionSchema = z.object({
    // The client sends this as `url`, but internally we treat it as repoUrl.
    url: z.string().min(1, 'Repository URL is required'),
    prompt: z.string().min(1, 'Prompt is required'),
    type: z.string().optional(),
    sessionId: z.string().min(1, 'sessionId is required'),
});
export const addMessageSchema = z.object({
    sessionId: z.string().min(1, 'sessionId is required'),
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1, 'content is required'),
    repoUrl: z.string().min(1, 'repoUrl is required'),
});
