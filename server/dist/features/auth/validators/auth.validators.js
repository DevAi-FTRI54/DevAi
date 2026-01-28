/**
 * Authentication Request Validators
 *
 * This file defines Zod schemas for validating authentication-related requests.
 * These schemas ensure that incoming data is in the correct format before we try
 * to process it, preventing errors and security issues.
 *
 * Each schema is like a contract that says "this is what we expect, and we won't
 * accept anything else." This makes our API more predictable and easier to use,
 * and it helps catch bugs early (both on the client side and server side).
 */
import { z } from 'zod';
/**
 * Complete Authentication Request Schema
 *
 * When a user completes the GitHub OAuth flow, GitHub redirects them back to our
 * app with an authorization code. This code is a one-time-use token that we exchange
 * for an access token.
 *
 * We validate that:
 * - The code is present (required)
 * - The code is a non-empty string
 *
 * This prevents issues like:
 * - Missing codes (would cause GitHub API errors)
 * - Empty strings (would cause authentication failures)
 * - Wrong data types (would cause runtime errors)
 */
export const completeAuthSchema = z.object({
    code: z
        .string()
        .min(1, 'Authorization code is required and cannot be empty')
        .describe('GitHub OAuth authorization code (one-time use token)'),
});
/**
 * Get Organizations Query Schema
 *
 * When fetching a user's GitHub organizations, we can optionally filter by a specific
 * organization name. This is useful when we want to check if a particular org is
 * available or get details about a specific org.
 *
 * The org parameter is optional - if not provided, we'll return all organizations
 * the user has access to.
 */
export const getOrgsQuerySchema = z.object({
    org: z
        .string()
        .optional()
        .describe('Optional organization name to filter results'),
});
/**
 * List Repositories Query Schema
 *
 * When listing repositories, we can filter by:
 * - Organization name (to show repos for a specific org)
 * - Installation ID (to show repos for a specific GitHub App installation)
 *
 * Both are optional - if neither is provided, we'll use the default installation
 * from the user's cookies.
 */
export const listReposQuerySchema = z.object({
    org: z
        .string()
        .optional()
        .describe('Optional organization name to filter repositories'),
    installation_id: z
        .string()
        .optional()
        .describe('Optional GitHub App installation ID to filter repositories'),
});
/**
 * Get GitHub Token Query Schema
 *
 * This endpoint doesn't typically need query parameters, but we define an empty
 * schema here for consistency and to make it easy to add parameters in the future
 * if needed (like filtering by token type or scope).
 */
export const getGithubTokenQuerySchema = z.object({});
