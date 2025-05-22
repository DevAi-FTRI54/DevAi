// Defines API routes for user authentication (login, signup, etc).
import express, { Router } from 'express';
import { authController } from './auth.controller.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import Project from '../../models/project.model.js';

console.log('typeof Project:', typeof Project); // should be "function"
console.log('Project.find exists:', typeof Project.find === 'function');

const router: Router = express.Router();

router.get('/projects', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const projects = await Project.find({ user: userId });
  res.json(projects);
});
