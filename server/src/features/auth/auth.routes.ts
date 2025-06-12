// Defines API routes for user authentication (login, signup, etc).
import express, { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { getGitHubUserOrgs } from './controllers/auth.controller.js';
import { saveInstallationId } from '../githubApp/githubApp.controller.js';
import { logout } from './controllers/auth.controller.js';
import Project from '../../models/project.model.js';
import {
  getGitHubLoginURL,
  handleGitHubCallback,
  listRepos,
  getGithubToken,
} from './controllers/auth.controller.js';

console.log('Loading auth.routes.ts');
const router: Router = express.Router();

// /api/auth/
router.get('/github', getGitHubLoginURL);
router.get('/callback', handleGitHubCallback);
router.get('/repos', listRepos);
router.get('/github-token', getGithubToken);
router.get('/orgs', requireAuth, getGitHubUserOrgs);
//Logout/ remove all three cookie instances
router.post('/logout', logout);
// Redirect after Github App install:
router.get('/app/install/callback', requireAuth, saveInstallationId);

export default router;
