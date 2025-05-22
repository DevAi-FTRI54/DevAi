// Handles interaction with the RAG service, including context retrieval and LLM querying.

import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Annotation, StateGraph } from '@langchain/langgraph';
import { Document } from '@langchain/core/documents';
import { z } from 'zod';
import { createCodeRetriever } from '../indexing/vector.service.js';
import { generateUnqiueRepoId } from '../indexing/git.service.js';
import { CohereRerank } from '@langchain/cohere';
import { RUN_KEY } from '@langchain/core/outputs';

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

// --- Helpers ---------------------------------------------------------------
const MAX_TOKENS = 6_000;
function roughTokens(txt: string) {
  return Math.ceil(txt.length / 4);
}

const formatDoc = (d: Document) =>
  `FILE NAME: ${d.metadata.declarationName} \nFILE: ${d.metadata.filePath} (lines ${d.metadata.startLine}-${d.metadata.endLine})\n---\n${d.pageContent}\n====`;

// --- Simulation ------------------------------------------------------------
// const repoUrl = '';
// const question = 'Where do I find MongoDB?';

// --- answerQuestion function -----------------------------------------------
export async function answerQuestion(repoUrl: string, question: string) {
  const repoId = generateUnqiueRepoId(repoUrl);

  // const repoExists = await checkRepositoryExists(repoId); // You need to implement this function
  // if (!repoExists) {
  //   throw new Error('REPOSITORY_NOT_INDEXED');
  // }

  const retriever = await createCodeRetriever(repoId, 8);

  // --- STEP 1: Define Prompt -----------------------------------------------
  const SYSTEMPROMPT = "You are an expert code assistant that answers user's questions about their codebase.";

  const USERPROMPT = `Use the following pieces of context to answer the question at the end.
    If you don't know the answer, just say that you don't know, don't try to make up an answer.
    Use three sentences maximum and keep the answer as concise as possible.
    Always say "thanks for asking!" at the end of the answer.

    Context: {context}\n\n

    Question: {question}
    
    Helpful answer:`;

  const promptTemplate = ChatPromptTemplate.fromMessages([
    ['system', SYSTEMPROMPT],
    ['user', USERPROMPT],
  ]);

  // --- STEP 2: Define States -----------------------------------------------
  // https://langchain-ai.github.io/langgraphjs/concepts/low_level/#multiple-schemas

  const InputState = Annotation.Root({
    question: Annotation<string>,
  });

  const WorkingState = Annotation.Root({
    question: Annotation<string>,
    context: Annotation<Document[]>,
    response: Annotation<typeof qa.shape>,
  });

  // --- STEP 3: Define Application Steps ------------------------------------
  // https://v03.api.js.langchain.com/classes/_langchain_openai.ChatOpenAI.html
  // Streaming; Metadata - tokens

  const retrieve = async (state: typeof InputState.State) => {
    try {
      const retrievedDocs = await retriever.invoke(state.question);
      return { context: retrievedDocs }; // merges into  WorkingState, thus the WorkingState has now access to both question + context
    } catch (err) {
      throw new Error('VECTOR_DB_DOWN');
    }
  };

  // --- STEP 4: Rerank the retrievedDocs for increase accuracy --------------
  // cohere rerank: https://js.langchain.com/docs/integrations/document_compressors/cohere_rerank/
  const rerank = async (state: typeof WorkingState.State) => {
    const reranker = new CohereRerank({
      apiKey: process.env.COHERE_API_KEY,
      model: 'rerank-english-v2.0',
      topN: 5,
    });

    const ranks = await reranker.rerank(state.context, state.question);
    const topDocs = ranks.map((r: any) => state.context[r.index]);

    return { context: topDocs };
  };

  const generate = async (state: typeof WorkingState.State) => {
    // // Option #1: Generate context for the prompt
    // const docsContent = state.context
    //   .map(
    //     (d) =>
    //       `FILE NAME: ${d.metadata.declarationName} \nFILE: ${d.metadata.filePath} (lines ${d.metadata.startLine}-${d.metadata.endLine})\n---\n${d.pageContent}\n====`
    //   )
    //   .join('\n');

    // Option #2: Avoid $50+ API calls by limiting the numbre of tokens allowed to be spend on the prompt
    let promptBody = '';
    for (const doc of state.context) {
      const nextChunk = formatDoc(doc);
      if (roughTokens(promptBody + nextChunk) > MAX_TOKENS) break;
      promptBody += nextChunk;
    }
    /* Example format:

        FILE: server/src/features/queries/rag.service.ts (lines 10-42)
        ---
        …code here…
        =====
        FILE: client/src/compoments/app.tsx (lines 1-23)
        ---
        …code here…
        =====

    */

    // pipe: https://v03.api.js.langchain.com/classes/_langchain_openai.ChatOpenAI.html#pipe
    // Create a new runnable sequence that runs each individual runnable in series, piping the output of one runnable into another runnable or runnable-like.
    const answerChain = promptTemplate.pipe(structuredLlm);
    const response = await answerChain.invoke({
      question: state.question,
      context: promptBody,
    });

    return { response };
  };

  // --- STEP 5: Compile & Test the Application ------------------------------
  /* How Data Moves
  
        A((InputState)) --> |retrieve| B((WorkingState));
        B --> |generate| C((WorkingState with answer));

        1/ InputState (only question) is what you supply to workflow.invoke.
        2/ 'retrieve' returns { context }.
        3/ LangGraph merges that with the previous state → now we have { question, context }. 
            -> Because the key names overlap (question) they’re automatically shared.
        4/ 'generate' adds { response }.
   
    */

  const workflow = new StateGraph(InputState) // 👈 compile over InputState
    .addNode('retrieve', retrieve)
    .addNode('rerank', rerank)
    .addNode('generate', generate)
    .addEdge('__start__', 'retrieve')
    .addEdge('retrieve', 'rerank')
    .addEdge('rerank', 'generate')
    .addEdge('generate', '__end__')
    .compile();

  const result = await workflow.invoke({ question }, { runName: 'ask-question', configurable: { repoId } });

  const traceUrl = (result as any)[RUN_KEY]?.url ?? null; // LLM observability
  const tokens = (result as any)[RUN_KEY]?.totalTokens ?? undefined;
  const latency = (result as any)[RUN_KEY]?.durationMs ?? undefined;

  // --- STEP 6: Store the Result in MongoDB ---------------------------------

  return {
    result,
    traceUrl,
    tokens,
    latency,
  };
}

// console.log(answerQuestion(repoUrl, question));
