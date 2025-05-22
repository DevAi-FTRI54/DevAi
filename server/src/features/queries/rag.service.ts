// Handles interaction with the RAG service, including context retrieval and LLM querying.

import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Annotation, StateGraph } from '@langchain/langgraph';
import { Document } from '@langchain/core/documents';
import { z } from 'zod';
import { createCodeRetriever } from '../indexing/vector.service.js';
import { generateUnqiueRepoId } from '../indexing/git.service.js';

// --- Structured Output for ChatOpenAI --------------------------------------
// https://v03.api.js.langchain.com/classes/_langchain_openai.ChatOpenAI.html
// Create a new instance of ChatOpenAI, include required options
const llm = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0,
  maxTokens: undefined,
  timeout: undefined,
  maxRetries: 2,
  apiKey: process.env.OPENAI_API_KEY,
});

// Define response schema such that we handle multiple queries (multiple responses)
const qa = z.object({
  answer: z.string(),
  citations: z.array(
    z.object({
      file: z.string(),
      startLine: z.number(),
      endLine: z.number(),
      snippet: z.string(),
    })
  ),
});

const structuredLlm = llm.withStructuredOutput(qa, {
  method: 'jsonSchema',
  strict: true,
});

// --- Simulation ------------------------------------------------------------
// const repoUrl = '';
// const question = 'Where do I find MongoDB?';

// --- answerQuestion function -----------------------------------------------
export async function answerQuestion(repoUrl: string, question: string) {
  const repoId = generateUnqiueRepoId(repoUrl);
  const retriever = await createCodeRetriever(repoId, 8);

  // --- STEP 1: Define Prompt -----------------------------------------------
  const systemPrompt =
    "You are an expert code assistant that answers user's questions about their codebase.";

  const userPrompt = `Use the following pieces of context to answer the question at the end.
    If you don't know the answer, just say that you don't know, don't try to make up an answer.
    Use three sentences maximum and keep the answer as concise as possible.
    Always say "thanks for asking!" at the end of the answer.

    Context: {context}\n\n

    Question: {question}
    
    Helpful answer:`;

  const promptTemplate = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['user', userPrompt],
  ]);

  // --- STEP 2: Define States -----------------------------------------------
  // https://langchain-ai.github.io/langgraphjs/concepts/low_level/#multiple-schemas

  //   const InputStateAnnotation = Annotation.Root({
  //     question: Annotation<string>,
  //   });

  const State = Annotation.Root({
    question: Annotation<string>,
    context: Annotation<Document[]>,
    response: Annotation<typeof qa.shape>,
  });

  // --- STEP 3: Define Application Steps ------------------------------------
  // https://v03.api.js.langchain.com/classes/_langchain_openai.ChatOpenAI.html
  // -> Streaming -
  // -> Structured output - rating, file names, startline, endline, relevant file names
  // -> Metadata - tokens

  const retrieve = async (state: typeof State.State) => {
    console.log('--- retrieve(InputState) ---------');
    console.log(state);
    const retrievedDocs = await retriever.invoke(state.question);
    return { context: retrievedDocs };
  };

  const generate = async (state: typeof State.State) => {
    console.log('--- generate(OverallState) ---------');
    console.log(state);
    const docsContent = state.context.map((doc) => doc.pageContent).join('\n');

    const messages = await promptTemplate.invoke({
      question: state.question,
      context: docsContent,
    });
    console.log('--- generate(messages) ---------');
    console.log(messages);

    const response = await structuredLlm.invoke(messages);
    console.log('--- generate(response) ---------');
    console.log(response);
    return { response: response };
  };

  // --- STEP 4: Compile & Test the Application ------------------------------
  const workflow = new StateGraph(State)
    .addNode('retrieve', retrieve)
    .addNode('generate', generate)
    .addEdge('__start__', 'retrieve')
    .addEdge('retrieve', 'generate')
    .addEdge('generate', '__end__')
    .compile();

  const result = await workflow.invoke({ question });
  return result;

  // --- STEP 5: Store the Result in MongoDB ---------------------------------
}

// console.log(answerQuestion(repoUrl, question));
