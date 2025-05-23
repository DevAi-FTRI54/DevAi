// Receives queries from the client and invokes RAG processing logic.
import { Request, Response, NextFunction } from 'express';
import { answerQuestion } from './rag.service.js';
import { OpenAIError } from 'openai';

import { QdrantVectorStore } from '@langchain/qdrant';
import Query from '../../models/query.model.js';
import User from '../../models/user.model.js';

export const askController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { repoUrl, question } = req.body;
    const response = await answerQuestion(repoUrl, question);
    res.status(200).json(response);
  } catch (err: any) {
    console.log('--- Error inside askController ------------');
    console.error(err);

    if (err instanceof OpenAIError) {
      res
        .status(502)
        .json({ message: 'askController: LLM failed', detail: err.message });
    }
    if (err.message === 'VECTOR_DB_DOWN') {
      res.status(503).json({ msg: 'askController: Vector store unavailable' });
    } else {
      res
        .status(500)
        .json({ message: 'askController: Unexpected server error' });
      res.status(500).json({ message: 'askController: Unexpected server error' });
    }
  }
};

// export const createQuery = async (req: Request, res: Response) => {
//   try {
//     const { question, tags } = req.body; // pull question from request body, also tag if we use it
//     const userId = req.user._id; // needs authentication middleware;

//     // Store the query to the MongoDB
//     const newQuery = await Query.create({
//       user: userId,
//       question,
//       tags,
//     });

//     // Adding the query ID to the user to trace chat history
//     await User.findByIdAndUpdate(userId, {
//       $push: { queries: newQuery._id }, // $push is a MongoDB operator that adds a value to an array.
//     });

//     res.status(201).json(newQuery);
//   } catch (error) {
//     console.error('Error creating query:', error);
//     res.status(500).json({ error: 'Internal Server Error' });
//   }
// };
