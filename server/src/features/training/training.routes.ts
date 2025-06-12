import express from 'express';
import {
  exportTrainingData,
  checkTrainingReadiness,
  triggerTraining,
  startTrainingRun,
  completeTrainingRun,
} from './training.controller.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { requireTeamAuth } from '../../middleware/teamAuthMiddleware.js';

const router = express.Router();

// Check if we have enough data for fine-tuning (requires team auth)
router.get('/check-readiness', requireTeamAuth, checkTrainingReadiness);

// Export training data (requires team auth - for automated use)
router.get('/export-data', requireTeamAuth, exportTrainingData);

// Trigger fine-tuning job (requires team auth - for automated use)
router.post('/trigger-training', requireTeamAuth, triggerTraining);

// Start a training run (requires team auth - for automated jobs)
router.post('/start-run', requireTeamAuth, startTrainingRun);

// Complete a training run (requires team auth - for automated jobs)
router.post('/complete-run', requireTeamAuth, completeTrainingRun);

export default router;
