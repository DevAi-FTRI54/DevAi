import express from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { getUserMessagesFlat } from './chatHistory.controller.js';
import {
  getUserConversations,
  getSessionConversation,
} from './chatHistory.controller.js';

const router = express.Router();

router.get('/history', requireAuth, getUserConversations); // All user's convos
router.get('/history/session', requireAuth, getSessionConversation); // Get by session
router.get('/history/flat', requireAuth, getUserMessagesFlat);
export default router;
