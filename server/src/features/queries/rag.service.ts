/**
 * RAG (Retrieval-Augmented Generation) Service
 *
 * This is the brain of our code understanding system! When a user asks a question about
 * their codebase, this service:
 *
 * 1. Retrieves relevant code chunks from our vector database (semantic search)
 * 2. Reranks them to find the most relevant ones (using Cohere if available)
 * 3. Assembles context from the code chunks and conversation history
 * 4. Sends everything to GPT-4o-mini to generate an intelligent answer
 * 5. Returns the answer with citations (file paths, line numbers)
 *
 * The "RAG" approach means we're not just asking the AI to remember everything - we're
 * giving it the actual code context it needs to answer accurately. It's like having a
 * really smart assistant who can instantly look up any code in your repository!
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Annotation, StateGraph } from '@langchain/langgraph';
import { Document } from '@langchain/core/documents';
import { z } from 'zod';
import { createCodeRetriever } from '../indexing/vector.service.js';
import { generateUniqueRepoId } from '../indexing/git.service.js';
import { CohereRerank } from '@langchain/cohere';
import { RUN_KEY } from '@langchain/core/outputs';
import { SYSTEM_PROMPTS } from './prompts.js';
import Conversation from '../../models/conversation.model.js';
import { Message } from '../../models/conversation.model.js';
import { OPENAI_API_KEY, COHERE_API_KEY } from '../../config/env.validation.js';
import { logger } from '../../utils/logger.js';

/**
 * OpenAI LLM Instance for Answer Generation
 *
 * We use GPT-4o-mini for generating answers because it's:
 * - Fast enough for real-time responses
 * - Capable of understanding code context
 * - Cost-effective for frequent use
 *
 * The API key comes from our validated environment configuration, so we know it's
 * present and valid before we try to use it. If it's missing, the server won't even
 * start - much better than failing when a user asks a question!
 *
 * Documentation: https://v03.api.js.langchain.com/classes/_langchain_openai.ChatOpenAI.html
 */
const llm = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0, // Low temperature for consistent, factual answers
  maxTokens: undefined, // Let the model decide based on context
  timeout: undefined, // Use default timeout
  maxRetries: 2, // Retry failed requests up to 2 times
  apiKey: OPENAI_API_KEY, // Validated at startup - guaranteed to be valid
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
    }),
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

const formatConversationHistory = (messages: Message[]) => {
  if (!messages?.length) {
    return 'No previous context. ,This is the start of the conversation.';
  }

  return messages
    .slice(-30)
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n\n');
};

// --- answerQuestion function -----------------------------------------------
export async function answerQuestion(
  repoUrl: string,
  question: string,
  type: string,
  sessionId: string,
) {
  logger.info('--- RAG SERVICE STARTED ---', {
    repoUrl,
    sessionId,
    type,
  });
  logger.debug('📝 Question', { question });

  const repoId = generateUniqueRepoId(repoUrl);
  const retriever = await createCodeRetriever(repoId, 8);

  // --- STEP 1: Define Prompt -----------------------------------------------
  // --- PROVIDE PAST CONVERSATIONS AS CONTEXT ---------
  const sessionHistory = await Conversation.findOne({ sessionId }); // Search for n number of the most recent interactions based on the sessionId

  logger.debug('📚 Session history', {
    found: !!sessionHistory,
    messages: sessionHistory?.messages?.length || 0,
  });

  const previousContext = formatConversationHistory(
    sessionHistory?.messages || [],
  );

  // --- SYSTEM PROMPT ---------
  const prompts = SYSTEM_PROMPTS as Record<string, { content: string }>;
  const systemPromptType = type in prompts ? type : 'Find';
  const selectedSystemPrompt = prompts[systemPromptType].content;
  const finalSystemPrompt = `
  Your system prompt: 
  
  ${selectedSystemPrompt}\n\n 
  
  Previous conversation context: 
  
  ${previousContext}`;

  // --- USER PROMPT ---------
  const USERPROMPT = `Use the following pieces of context to answer the question at the end.

    Context: {context}\n\n

    Question: {question}
    
    Helpful answer:`;

  const promptTemplate = ChatPromptTemplate.fromMessages([
    ['system', finalSystemPrompt],
    ['user', USERPROMPT],
  ]);

  logger.debug('--- systemPrompt ---', {
    systemPromptType,
    promptLength: finalSystemPrompt.length,
  });

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
      logger.debug(`Attempting to retrieve docs for repo: ${repoId}`);

      const retrievedDocs = await retriever.invoke(state.question);

      return { context: retrievedDocs }; // merges into  WorkingState, thus the WorkingState has now access to both question + context
    } catch (err) {
      throw new Error('VECTOR_DB_DOWN');
    }
  };

  /**
   * Rerank Retrieved Documents for Better Accuracy
   *
   * After we retrieve code chunks from the vector database, we have a list of potentially
   * relevant code. But "potentially relevant" isn't good enough - we want the MOST relevant!
   *
   * That's where Cohere's reranking comes in. It uses a specialized model to reorder our
   * results based on how well they actually match the user's question. This dramatically
   * improves answer quality because we're giving the LLM the best context possible.
   *
   * Cohere rerank is optional - if the API key isn't configured, we just use the original
   * order from the vector search. It still works, just not quite as well!
   *
   * Documentation: https://js.langchain.com/docs/integrations/document_compressors/cohere_rerank/
   */
  const rerank = async (state: typeof WorkingState.State) => {
    // If we don't have any documents, there's nothing to rerank!
    if (!state.context || state.context.length === 0) {
      logger.debug('No documents to rerank - skipping reranking step');
      return { context: [] };
    }

    try {
      // Cohere rerank is optional - if the API key isn't set, we'll just use the original
      // order from vector search. It's still good, just not as optimized!
      if (!COHERE_API_KEY) {
        logger.debug(
          'COHERE_API_KEY not configured - skipping rerank (using original order)',
        );
        return { context: state.context }; // Return original docs in their original order
      }

      // Create the reranker with our validated API key
      // We use rerank-v3.5 which is Cohere's latest and most accurate reranking model
      // We only rerank the top 5 results to balance accuracy with speed
      // Documentation: https://docs.cohere.com/v2/docs/models
      const reranker = new CohereRerank({
        apiKey: COHERE_API_KEY, // Validated at startup - guaranteed to be valid if we reach here
        model: 'rerank-v3.5',
        topN: Math.min(5, state.context.length), // Rerank up to 5 results (or all if we have fewer)
      });

      logger.debug(`Reranking ${state.context.length} documents...`);

      const ranks = await reranker.rerank(state.context, state.question);

      if (!ranks || !Array.isArray(ranks)) {
        logger.error('Reranker returned invalid result', { ranks });
      }

      const topDocs = ranks.map((r: any) => state.context[r.index]);

      return { context: topDocs };
    } catch (err) {
      logger.error('Error during reranking', { err });
      return { context: state.context }; // Return original docs
    }
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
    logger.debug('--- response ---', {
      hasAnswer: !!response?.answer,
      citations: response?.citations?.length,
    });

    // --- STEP 5: Store the Result in MongoDB ---------------------------------
    // Store the assistant's message:
    await Conversation.updateOne(
      {
        sessionId,
      },
      {
        $push: {
          messages: [
            {
              role: 'assistant',
              content: response.answer,
              citations: response.citations,
            },
          ],
        },
      },
    );

    return { response };
  };

  // --- STEP 6: Compile & Test the Application ------------------------------
  /* How Data Moves
  
        A((InputState)) --> |retrieve| B((WorkingState));
        B --> |generate| C((WorkingState with answer));

        1/ InputState (only question) is what you supply to workflow.invoke.
        2/ 'retrieve' returns { context }.
        3/ LangGraph merges that with the previous state → now we have { question, context }. 
            -> Because the key names overlap (question) they’re automatically shared.
        4/ 'generate' adds { response }.
   
    */

  const workflow = new StateGraph(WorkingState) // 👈 compile over WorkingState
    .addNode('retrieve', retrieve)
    .addNode('rerank', rerank)
    .addNode('generate', generate)
    .addEdge('__start__', 'retrieve')
    .addEdge('retrieve', 'rerank')
    .addEdge('rerank', 'generate')
    .addEdge('generate', '__end__')
    .compile();

  const result = await workflow.invoke(
    { question },
    { runName: 'ask-question', configurable: { repoId } },
  );

  const traceUrl = (result as any)[RUN_KEY]?.url ?? null; // LLM observability
  const tokens = (result as any)[RUN_KEY]?.totalTokens ?? undefined;
  const latency = (result as any)[RUN_KEY]?.durationMs ?? undefined;

  return {
    result,
    traceUrl,
    tokens,
    latency,
  };
}
