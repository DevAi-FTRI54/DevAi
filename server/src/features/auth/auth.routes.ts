// Defines API routes for user authentication (login, signup, etc).
import express, { Router } from 'express';
// import { requireAuth } from '../../middleware/authMiddleware.js';
// import Project from '../../models/project.model.js';
import { getGitHubLoginURL, handleGitHubCallback, completeAuth } from './auth.controller.js';

// console.log('typeof Project:', typeof Project); // should be "function"
// console.log('Project.find exists:', typeof Project.find === 'function');
console.log('Loading auth.routes.ts');

const router: Router = express.Router();

router.get('/github', getGitHubLoginURL);
router.get('/callback', handleGitHubCallback);
router.get('/complete', completeAuth);

export default router;
