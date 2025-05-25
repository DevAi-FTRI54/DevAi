// Defines API routes for user authentication (login, signup, etc).
import express, { Router } from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { saveInstallationId } from '../githubApp/githubApp.controller.js';
import Project from '../../models/project.model.js';
import {
  getGitHubLoginURL,
  handleGitHubCallback,
  completeAuth,
} from './auth.controller.js';

// console.log('typeof Project:', typeof Project); // should be "function"
// console.log('Project.find exists:', typeof Project.find === 'function');
console.log('Loading auth.routes.ts');

const router: Router = express.Router();

router.get('/github', getGitHubLoginURL);
router.get('/callback', handleGitHubCallback);
router.get('/complete', completeAuth);

router.get('/app/install/callback', requireAuth, saveInstallationId);
//redirect after Github App install;

//in GitHub App setting: Callback URL: https://your-backend.com/api/auth/app/install/callback
// testing setting: http://localhost:3333/api/auth/app/install/callback

export default router;
