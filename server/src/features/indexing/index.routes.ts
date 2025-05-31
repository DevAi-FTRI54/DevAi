import express from 'express';
import { indexRepo, getJobStatus } from './index.controller.js';

const router = express.Router();
router.post('/ingest', indexRepo, (_req, res) => {
  console.log('✅ Repo indexed successfully');
  // res.status(200).json();
});

router.get('/status/:id', getJobStatus);

export default router;
