// Defines API routes for submitting and handling user queries.
import express from 'express';
import { askController } from './query.controller.js';

const router = express.Router();
router.post('/question', askController, (req, res) => {
  res.status(200).json();
});

export default router;
