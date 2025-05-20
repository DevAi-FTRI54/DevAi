import express, { Request, Response } from 'express';
import { cloneRepo } from '../services/git.services.js';

// Local testing for GitHub repo indexing
export const indexRepo = (req: Request, res: Response) => {
  const { repoUrl, sha = 'HEAD' } = req.body;

  cloneRepo(repoUrl, sha)
    .then((localRepoPath) => console.log('repo path:', localRepoPath))
    .catch((err) => console.error('repo clone failed:', err));

  res.json({ status: 'indexing-started' });
};
