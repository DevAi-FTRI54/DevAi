// Defines API routes for submitting and handling user queries.
import express from 'express';
import { askController, addMessage } from './query.controller.js';

const router = express.Router();

router.post('/question', askController);
router.post('/store', addMessage);

export default router;
