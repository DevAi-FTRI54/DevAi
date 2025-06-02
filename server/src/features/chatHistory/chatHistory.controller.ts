import { Request, Response } from 'express';
import Query from '../../models/query.model.js';

export const getChatHistory = async (req: Request, res: Response) => {
  try {
    const { userId, projectId, repoId, sessionId } = req.query;
    const filter: any = {};
    if (userId) filter.user = userId;
    if (projectId) filter.project = projectId;
    if (repoId) filter.repo = repoId;
    if (sessionId) filter.sessionId = sessionId;

    const history = await Query.find(filter).sort({ createdAt: 1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
};
