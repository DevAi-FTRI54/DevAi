// Handles interaction with the RAG service, including context retrieval and LLM querying.

import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { pull } from 'langchain/hub';
import { Annotation } from '@langchain/langgraph';
import { Document } from '@langchain/core/documents';
import { z } from 'zod';
import { createRetriever } from '../indexing/vector.service.js';
import { generateUnqiueRepoId } from '../indexing/git.service.js';

const llm = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0,
  maxTokens: undefined,
  timeout: undefined,
  maxRetries: 2,
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Simulation ------------------------------------------------------------
const repoUrl = '';
const question = 'Where do I find MongoDB?';

// --- answerQuestion function -----------------------------------------------
export async function answerQuestion(repoUrl: string, question: string) {
  const repoId = generateUnqiueRepoId(repoUrl);

  // --- STEP 1: Define Prompt -----------------------------------------------
  // Define prompt template
  /**
   * const { question } = req.body
   * - we have a question / tag from the user
   * - where do we define a system prompt? -> https://smith.langchain.com/o/d8944e14-4793-4347-850d-c2f3d8dc5435/playground
   * -> have to define our prompt:
   *
   */
  const promptTemplate = await pull<ChatPromptTemplate>('rlm/rag-prompt');

  const user_prompt = await promptTemplate.invoke({
    context: '(context goes here)',
    question: '(question goes here)',
  });

  // --- STEP 2: Define States -----------------------------------------------
  // https://langchain-ai.github.io/langgraphjs/concepts/low_level/#multiple-schemas

  const InputStateAnnotation = Annotation.Root({
    question: Annotation<string>,
  });

  const OverallStateAnnotation = Annotation.Root({
    question: Annotation<string>,
    context: Annotation<Document[]>,
    answer: Annotation<string>,
  });

  // --- STEP 3: Define Application Steps ------------------------------------
  // https://v03.api.js.langchain.com/classes/_langchain_openai.ChatOpenAI.html
  // -> Streaming -
  // -> Structured output - rating, file names, startline, endline, relevant file names
  // -> Metadata - tokens

  const retrieve = async (state: typeof InputStateAnnotation.State) => {
    const retriever = await createRetriever(repoId, 8);
    const retrievedDocs = await retriever.getRelevantDocuments(state.question);
    return { context: retrievedDocs };
  };

  const generate = async (state: typeof OverallStateAnnotation.State) => {
    console.log('--- generate(state) ---------');
    console.log(state);
    const docsContent = state.context.map((doc) => doc.pageContent).join('\n');
    const messages = await promptTemplate.invoke({
      question: state.question,
      context: docsContent,
    });
    const response = await llm.invoke(messages);
    return { answer: response.content };
  };

  // --- STEP 4: Comple & Test the Application -------------------------------
  // --- STEP 5: Store the Result in MongoDB ---------------------------------
}

console.log(answerQuestion(repoUrl, question));
