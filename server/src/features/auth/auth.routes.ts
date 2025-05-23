// Defines API routes for user authentication (login, signup, etc).
import express, { Router } from 'express';
import { authController } from './auth.controller.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import Project from '../../models/project.model.js';
import { getGitHubLoginURL } from './auth.controller.js';
import { handleGitHubCallback } from './auth.controller.js';

console.log('typeof Project:', typeof Project); // should be "function"
console.log('Project.find exists:', typeof Project.find === 'function');

const router: Router = express.Router();

router.get('/github', getGitHubLoginURL);

router.get('/callback', handleGitHubCallback);
