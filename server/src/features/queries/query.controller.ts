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
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { url: repoUrl, prompt: question, type: type } = req.body;

    res.write(
      `data: ${JSON.stringify({
        type: 'status',
        message: 'Retrieving code...',
      })}\n\n`
    );

    const response = await answerQuestion(repoUrl, question, type);

    const answer = String(response.result.response.answer);
    const citations = response.result.response.citations;

    const chunkSize = 5;
    const words = answer.split(' ');

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      res.write(
        `data: ${JSON.stringify({ type: 'answer_chunk', content: chunk })}\n\n`
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    res.write(
      `data: ${JSON.stringify({
        type: 'citations',
        data: citations,
        question: question,
      })}\n\n`
    );
    res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
    res.end();
    // res.status(200).json(response);
  } catch (err: any) {
    console.log('--- Error inside askController ------------');
    console.error(err);

    res.write(
      `data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`
    );
    res.end();

    // if (err instanceof OpenAIError) {
    //   res
    //     .status(502)
    //     .json({ message: 'askController: LLM failed', detail: err.message });
    // }
    // if (err.message === 'VECTOR_DB_DOWN') {
    //   res.status(503).json({ msg: 'askController: Vector store unavailable' });
    // } else {
    //   res
    //     .status(500)
    //     .json({ message: 'askController: Unexpected server error' });
    // }
  }
};
