// server/controllers/chatController.ts
import { Request, Response } from 'express';

// Extend the Request type to include the user property
interface AuthenticatedRequest extends Request {
  user?: { id: string };
}
import Query from '../../models/query.model.js';
import Conversation from '../../models/conversation.model.js';
import { logger } from '../../utils/logger.js';

export const getUserConversations = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    // Optionally: add repoUrl, sessionId, etc, as query params
    const conversations = await Conversation.find({ userId }).sort({
      updatedAt: -1,
    });
    res.json(conversations);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to fetch conversations', error: err });
  }
};

export const getSessionConversation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { sessionId } = req.query;
    const conversation = await Conversation.findOne({ userId, sessionId });
    if (!conversation) {
      res.status(404).json({ message: 'Conversation not found' });
      return;
    }
    res.json(conversation);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to fetch conversation', error: err });
  }
};
// In chatHistory.controller.ts

export const getUserMessagesFlat = async (req: Request, res: Response) => {
  logger.debug('getUserMessagesFlat called', { user: (req as any).user });

  try {
    const userId = (req as any).user.userId;
    logger.debug('Fetching history for userId', { userId });
    const conversations = await Conversation.find({ userId });
    logger.debug('Conversations found', { count: conversations.length });

    // Flatten user/assistant pairs into { userPrompt, answer, file, startLine, endLine }
    const flatMessages: {
      userPrompt: string;
      answer: string;
      file: string;
      startLine: string | number;
      endLine: string | number;
    }[] = [];

    conversations.forEach((conv) => {
      for (let i = 0; i < conv.messages.length; i++) {
        const msg = conv.messages[i];
        if (msg.role === 'user') {
          // Look for the *next* assistant message in the array
          const nextMsg = conv.messages[i + 1];
          if (nextMsg && nextMsg.role === 'assistant') {
            // Safely extract citation info if available
            let file = '';
            let startLine: string | number = '';
            let endLine: string | number = '';
            if (nextMsg.citations && nextMsg.citations.length > 0) {
              file = nextMsg.citations[0].file || '';
              startLine = nextMsg.citations[0].startLine ?? '';
              endLine = nextMsg.citations[0].endLine ?? '';
            }
            flatMessages.push({
              userPrompt: msg.content,
              answer: nextMsg.content,
              file,
              startLine,
              endLine,
            });
          }
        }
      }
    });

    res.json(flatMessages);
  } catch (err) {
    logger.error('Failed to fetch history', { err });
    res.status(500).json({ message: 'Failed to fetch history', error: err });
  }
};

// export const getUserMessagesFlat = async (req:Request, res:Response) => {
//   try {
//     // If req.user exists (from requireAuth), filter by user. Otherwise, show all.
//     let conversations;
//     if (req.user && req.user.id) {
//       conversations = await Conversation.find({ userId: req.user.id });
//     } else {
//       conversations = await Conversation.find({});
//     }

//     const flatMessages = conversations.flatMap(conv =>
//       conv.messages.map(msg => ({
//         ...msg,
//         sessionId: conv.sessionId,
//         repoUrl: conv.repoUrl,
//       }))
//     );

//     res.json(flatMessages);
//   } catch (err) {
//     res.status(500).json({ message: 'Failed to fetch history', error: err });
//   }
// };

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
    logger.error('Failed to fetch chat history', { err });
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
};
