import express from 'express';
import { getChatHistory } from './chatHistory.controller.js';

const router = express.Router();

router.get('/chat/history', getChatHistory);

export default router;
