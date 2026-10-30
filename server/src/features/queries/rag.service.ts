// Handles interaction with the RAG service, including context retrieval and LLM querying.

import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Annotation, StateGraph } from '@langchain/langgraph';
import { Document } from '@langchain/core/documents';
import { z } from 'zod';
import { createCodeRetriever, getChunksForFiles } from '../indexing/vector.service.js';
import { generateUniqueRepoId } from '../indexing/git.service.js';
import { rankDocuments } from './rerank.js';
import { dedupeDocs, ensureSnapshotInBackground, expansionFiles, snapshotImportGraph } from './expansion.js';
import { RUN_KEY } from '@langchain/core/outputs';
import type { Callbacks } from '@langchain/core/callbacks/manager';
import type { RunnableConfig } from '@langchain/core/runnables';
import { SYSTEM_PROMPTS } from './prompts.js';
import { toRagError } from './rag.errors.js';
import { cohereApiKey, COHERE_KEY_VAR } from '../../config/cohere.js';
import {
  assembleCitations,
  buildEvidence,
  formatEvidence,
  snapshotSourceRoot,
  type Citation,
  type CitationDiagnostics,
  type Evidence,
} from './evidence.js';
import Conversation from '../../models/conversation.model.js';
import { Message } from '../../models/conversation.model.js';

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

// The model references evidence by ID; file paths and snippets are filled in server-side (see evidence.ts).
const qa = z.object({
  answer: z.string(),
  citations: z.array(
    z.object({
      evidenceId: z.string(),
      startLine: z.number(),
      endLine: z.number(),
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

// Production default is v2.2; evals pass the version explicitly.
// v2.1: rerank the retrieved pool, keep 5.
// v2.2: rerank the pool, add every chunk of the top 5's files and their one-hop import neighbors, rerank
//       again and keep 8 (see evals/experiments/retrieval-pool-rag-v2.1-625d687.md).
export type RetrievalVersion = 'v2.1' | 'v2.2';
const RETRIEVAL = {
  'v2.1': { topN: 5, expandFrom: 0 },
  'v2.2': { topN: 8, expandFrom: 5 },
} as const;

// --- answerQuestion function -----------------------------------------------
export async function answerQuestion(
  repoUrl: string,
  question: string,
  type: string,
  sessionId: string,
  options?: { callbacks?: Callbacks; retrieval?: RetrievalVersion },
) {
  const retrieval = RETRIEVAL[options?.retrieval ?? 'v2.2'];
  console.log('--- RAG SERVICE STARTED ---------------');
  console.log('📝 Question:', question);
  console.log('🆔 SessionId:', sessionId);
  console.log('🔗 RepoUrl:', repoUrl);

  const repoId = generateUniqueRepoId(repoUrl);
  const retriever = await createCodeRetriever(repoId, 8).catch((err) => {
    throw toRagError(err, 'retrieve');
  });

  // --- STEP 1: Define Prompt -----------------------------------------------
  // --- PROVIDE PAST CONVERSATIONS AS CONTEXT ---------
  const sessionHistory = await Conversation.findOne({ sessionId }); // Search for n number of the most recent interactions based on the sessionId

  console.log('📚 Session history found:', !!sessionHistory);
  console.log('💬 Number of messages:', sessionHistory?.messages?.length || 0);

  const previousContext = formatConversationHistory(
    sessionHistory?.messages || [],
  );

  // --- SYSTEM PROMPT ---------
  const prompts = SYSTEM_PROMPTS as Record<string, { content: string }>;
  const systemPromptType =
    Object.keys(prompts).find(
      (key) => key.toLowerCase() === String(type ?? '').toLowerCase(),
    ) ?? 'Find';
  const selectedSystemPrompt = prompts[systemPromptType].content;
  const finalSystemPrompt = `
  Your system prompt: 
  
  ${selectedSystemPrompt}\n\n 
  
  Previous conversation context: 
  
  ${previousContext}`;

  // --- USER PROMPT ---------
  const USERPROMPT = `Use the following pieces of context to answer the question at the end.

    Each context block is an evidence item with an ID like [E1] and numbered source lines.
    Cite evidence only by its ID with the startLine/endLine (from the line numbers shown) that support your answer.
    Do not copy code into citations; the server attaches the exact source text.
    Answer the question completely using all of the available evidence. Citations identify supporting evidence;
    do not shorten or narrow the explanation because snippets are attached separately.

    Context: {context}\n\n

    Question: {question}
    
    Helpful answer:`;

  const promptTemplate = ChatPromptTemplate.fromMessages([
    ['system', finalSystemPrompt],
    ['user', USERPROMPT],
  ]);

  console.log('--- systemPrompt ---------');
  console.log(finalSystemPrompt);

  // --- STEP 2: Define States -----------------------------------------------
  // https://langchain-ai.github.io/langgraphjs/concepts/low_level/#multiple-schemas

  const InputState = Annotation.Root({
    question: Annotation<string>,
  });

  const WorkingState = Annotation.Root({
    question: Annotation<string>,
    context: Annotation<Document[]>,
    evidence: Annotation<Evidence[]>,
    response: Annotation<{ answer: string; citations: Citation[] }>,
    citationDiagnostics: Annotation<CitationDiagnostics>,
  });

  // --- STEP 3: Define Application Steps ------------------------------------
  // https://v03.api.js.langchain.com/classes/_langchain_openai.ChatOpenAI.html
  // Streaming; Metadata - tokens

  const retrieve = async (
    state: typeof InputState.State,
    config?: RunnableConfig,
  ) => {
    try {
      console.log(`Attempting to retrieve docs for repo: ${repoId}`);

      const retrievedDocs = await retriever.invoke(state.question, config);

      return { context: retrievedDocs }; // merges into  WorkingState, thus the WorkingState has now access to both question + context
    } catch (err) {
      throw toRagError(err, 'retrieve');
    }
  };

  // --- STEP 4: Rerank the retrievedDocs for increase accuracy --------------
  // cohere rerank: https://js.langchain.com/docs/integrations/document_compressors/cohere_rerank/
  const rerank = async (state: typeof WorkingState.State) => {
    // console.log('--- state ---------');
    // console.log(state);
    if (!state.context || state.context.length === 0) {
      console.log('No documents to rerank - skipping reranking step');
      return { context: [] };
    }

    try {
      if (!cohereApiKey()) {
        console.error(`${COHERE_KEY_VAR} is missing!`);
        return { context: state.context }; // Return original docs
      }

      console.log(`Reranking ${state.context.length} documents...`);
      const ranked = (await rankDocuments(state.context, state.question)).map((r) => r.doc);
      if (!retrieval.expandFrom) return { context: ranked.slice(0, retrieval.topN) };

      // Expansion failures keep the reranked pool rather than dropping to the unranked one.
      try {
        const top = ranked.slice(0, retrieval.expandFrom);
        const commitSha = (top[0]?.metadata?.commitSha as string | undefined) ?? null;
        const graph = commitSha ? snapshotImportGraph(repoId, commitSha) : null;
        if (commitSha && !graph) ensureSnapshotInBackground(repoUrl, repoId, commitSha);
        const extra = await getChunksForFiles(repoId, expansionFiles(top, graph), commitSha);
        const candidates = dedupeDocs([...ranked, ...extra]);
        console.log(`Expanded to ${candidates.length} candidates (${graph ? 'with' : 'without'} import graph)`);
        const final = (await rankDocuments(candidates, state.question)).map((r) => r.doc);
        return { context: final.slice(0, retrieval.topN) };
      } catch (err) {
        console.error('Error during candidate expansion:', err);
        return { context: ranked.slice(0, retrieval.topN) };
      }
    } catch (err) {
      console.error('Error during reranking:', err);
      return { context: state.context }; // Return original docs
    }
  };

  const generate = async (
    state: typeof WorkingState.State,
    config?: RunnableConfig,
  ) => {
    // // Option #1: Generate context for the prompt
    // const docsContent = state.context
    //   .map(
    //     (d) =>
    //       `FILE NAME: ${d.metadata.declarationName} \nFILE: ${d.metadata.filePath} (lines ${d.metadata.startLine}-${d.metadata.endLine})\n---\n${d.pageContent}\n====`
    //   )
    //   .join('\n');

    // Option #2: Avoid $50+ API calls by limiting the numbre of tokens allowed to be spend on the prompt.
    // The budget is measured on the plain doc format so line numbering does not change which docs are included.
    const allEvidence = buildEvidence(state.context, repoId);
    const evidence: Evidence[] = [];
    let budgetBody = '';
    let promptBody = '';
    for (const [i, doc] of state.context.entries()) {
      const nextChunk = formatDoc(doc);
      if (roughTokens(budgetBody + nextChunk) > MAX_TOKENS) break;
      budgetBody += nextChunk;
      evidence.push(allEvidence[i]);
      promptBody += formatEvidence(allEvidence[i], doc.metadata.declarationName);
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
    const response = await answerChain
      .invoke(
        {
          question: state.question,
          context: promptBody,
        },
        config,
      )
      .catch((err) => {
        throw toRagError(err, 'generate');
      });
    console.log('--- response ------------');
    console.log(response);

    const { citations, diagnostics } = assembleCitations(
      response.citations,
      evidence,
      snapshotSourceRoot,
    );
    console.log('--- citation diagnostics ------------');
    console.log(diagnostics);

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
              citations,
            },
          ],
        },
      },
    );

    return {
      evidence,
      response: { answer: response.answer, citations },
      citationDiagnostics: diagnostics,
    };
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
    {
      runName: 'ask-question',
      configurable: { repoId },
      callbacks: options?.callbacks,
    },
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
