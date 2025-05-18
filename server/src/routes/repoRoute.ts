import express from 'express';
import { indexRepo } from '../controllers/repo.controller.js';

const router = express.Router();
router.post('/ingest', indexRepo, (_req, res) => {
  res.status(200).json();
});

export default router;
