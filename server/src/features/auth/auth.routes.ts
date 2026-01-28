/**
 * Authentication Routes
 * 
 * This file defines all the routes related to user authentication and GitHub integration.
 * We use Express Router to organize these routes and apply middleware (like validation
 * and rate limiting) to protect them.
 */
import express, { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { getGitHubUserOrgs } from './controllers/auth.controller.js';
import { saveInstallationId } from '../githubApp/githubApp.controller.js';
import { logout } from './controllers/auth.controller.js';
import Project from '../../models/project.model.js';
import {
  getGitHubLoginURL,
  handleGitHubCallback,
  completeAuth,
  listRepos,
  getGithubToken,
} from './controllers/auth.controller.js';
import { validateBody, validateQuery } from '../../middleware/validation.js';
import {
  completeAuthSchema,
  getOrgsQuerySchema,
  listReposQuerySchema,
} from './validators/auth.validators.js';

import { logger } from '../../utils/logger.js';

logger.debug('Loading auth.routes.ts');
const router: Router = express.Router();

// /api/auth/
router.get('/github', getGitHubLoginURL);
router.get('/callback', handleGitHubCallback);

/**
 * Complete GitHub OAuth Authentication
 * 
 * This endpoint receives the authorization code from GitHub and exchanges it for
 * an access token. We validate the request body to ensure the code is present
 * and properly formatted before attempting the exchange.
 * 
 * POST /api/auth/complete
 * Body: { code: string }
 */
router.post('/complete', validateBody(completeAuthSchema), completeAuth);

/**
 * Get User's GitHub Organizations
 * 
 * Returns a list of GitHub organizations the authenticated user has access to.
 * Optionally filters by organization name if provided in query parameters.
 * 
 * GET /api/auth/orgs?org=optional-org-name
 * Note: This route doesn't use requireAuth middleware because it uses GitHub token
 * authentication instead of JWT. The getGitHubUserOrgs controller handles its own auth.
 */
router.get('/orgs', validateQuery(getOrgsQuerySchema), getGitHubUserOrgs);

/**
 * List Repositories
 * 
 * Returns repositories available to the user, optionally filtered by organization
 * or installation ID. We validate query parameters to ensure they're in the
 * correct format.
 * 
 * GET /api/auth/repos?org=optional-org&installation_id=optional-id
 */
router.get('/repos', validateQuery(listReposQuerySchema), listRepos);

/**
 * Get GitHub Token
 * 
 * Returns the user's GitHub access token (stored in secure cookies). This endpoint
 * doesn't require query parameters, but we validate to ensure consistency.
 * 
 * GET /api/auth/github-token
 */
router.get('/github-token', getGithubToken);

/**
 * Logout
 * 
 * Clears all authentication cookies (GitHub token, JWT, installation ID) to log the user out.
 * 
 * POST /api/auth/logout
 */
router.post('/logout', logout);

/**
 * GitHub App Installation Callback
 * 
 * Handles the redirect after a user installs our GitHub App. Requires authentication
 * to ensure only logged-in users can complete the installation flow.
 * 
 * GET /api/auth/app/install/callback
 */
router.get('/app/install/callback', requireAuth, saveInstallationId);

export default router;
