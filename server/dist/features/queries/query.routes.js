// Defines API routes for submitting and handling user queries.
import express from 'express';
import { askController, addMessage } from './query.controller.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
const router = express.Router();
router.post('/question', requireAuth, askController); //requireAuth added may need to remove
router.post('/store', requireAuth, addMessage); // requireAuth added may need to remove
export default router;
