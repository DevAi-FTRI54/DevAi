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
// router.get('/history/flat', getUserMessagesFlat);
router.get(
  '/history/flat',
  (req, res, next) => {
    console.log('Route matched');
    next();
  },
  requireAuth,
  getUserMessagesFlat
);

export default router;
