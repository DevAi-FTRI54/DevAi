// server/controllers/chatController.ts
import { Request, Response } from 'express';
import Query from '../../models/query.model.js';

export const getChatHistory = async (req: Request, res: Response) => {
  try {
    const { userId, projectId, repoId, sessionId, limit, offset } = req.query;

    // Build filter object based on params
    const filter: any = {};
    if (userId) filter.user = userId;
    if (projectId) filter.project = projectId;
    if (repoId) filter.repo = repoId;
    if (sessionId) filter.sessionId = sessionId;

    // Parse pagination parameters, fallback to default values
    const limitNum = parseInt(limit as string) || 50;
    //how many results to give, default is 50
    const offsetNum = parseInt(offset as string) || 0;
    //how many records to skip before returning results

    // Query the database with filters and pagination
    const history = await Query.find(filter) // retrieves filtered criteria
      .sort({ createdAt: 1 }) // oldest to newest
      .skip(offsetNum)
      .limit(limitNum);

    res.json(history);
  } catch (err) {
    console.error('Failed to fetch chat history:', err);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
};
