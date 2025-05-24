import express from 'express';
import { indexRepo } from './index.controller.js';

const router = express.Router();
router.post('/ingest', indexRepo, (_req, res) => {
  console.log('✅ Repo indexed successfully');
  res.status(200).json();
});

export default router;
