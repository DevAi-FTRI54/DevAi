import express from 'express';
import { indexRepo, getJobStatus } from './index-production.controller.js';

console.log('🔧 Using production indexing controller (Octokit-based)');

const router = express.Router();
router.post('/ingest', indexRepo);

router.get('/status/:id', getJobStatus);

export default router;
