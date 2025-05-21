// Receives queries from the client and invokes RAG processing logic.
import Query from '../../models/query.model.js';
import User from '../../models/user.model.js';
import { Request, Response } from 'express';
import { answerQuestion } from './rag.service.js';

export const ask = async (req: Request, res: Response) => {
  const { repoId, question } = req.body;
  const result = await answerQuestion(repoId, question);
  // store in MongoDB

  res.json(result);
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
