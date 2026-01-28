// Defines API routes for submitting and handling user queries.
import express from 'express';
import { askController, addMessage } from './query.controller.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { validateBody } from '../../middleware/validation.js';
import {
  addMessageSchema,
  askQuestionSchema,
} from './validators/query.validators.js';

const router = express.Router();

router.post(
  '/question',
  requireAuth,
  validateBody(askQuestionSchema),
  askController,
);
router.post('/store', requireAuth, validateBody(addMessageSchema), addMessage);

export default router;
