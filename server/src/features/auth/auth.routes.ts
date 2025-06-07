// Defines API routes for user authentication (login, signup, etc).
import express, { Router } from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { getGitHubUserOrgs } from './controllers/auth.controller.js';
import { saveInstallationId } from '../githubApp/githubApp.controller.js';
import Project from '../../models/project.model.js';
import {
  getGitHubLoginURL,
  handleGitHubCallback,
  completeAuth,
  listRepos,
  getGithubToken,
} from './controllers/auth.controller.js';

console.log('Loading auth.routes.ts');
const router: Router = express.Router();

// /api/auth/
router.get('/github', getGitHubLoginURL);
router.get('/callback', handleGitHubCallback);
router.get('/complete', completeAuth);
router.get('/repos', listRepos);
router.get('/github-token', getGithubToken);
router.get('/orgs', requireAuth, getGitHubUserOrgs);

// Redirect after Github App install:
router.get('/app/install/callback', requireAuth, saveInstallationId);

export default router;
