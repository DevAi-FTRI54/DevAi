// Handles interaction with the RAG service, including context retrieval and LLM querying.

import 'dotenv/config';
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
import { Ollama } from '@langchain/ollama';

// --- Structured Output for ChatOpenAI --------------------------------------
// https://v03.api.js.langchain.com/classes/_langchain_openai.ChatOpenAI.html
// Create a new instance of ChatOpenAI, include required options
const useLocalModel = process.env.USE_LOCAL_MODEL === 'true';

const llm = useLocalModel
  ? new Ollama({
      model: 'llama3:latest', // Use available model for testing
      baseUrl: 'http://localhost:11434',
      temperature: 0,
    })
  : new ChatOpenAI({
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

// Type for the structured response
type QAResponse = z.infer<typeof qa>;

// Type for Ollama's raw response
type OllamaResponse = {
  content?: string;
  text?: string;
  answer?: string;
  [key: string]: any;
};

// Only use structured output with OpenAI (Ollama doesn't support it yet)
const structuredLlm = useLocalModel
  ? llm // For Ollama, we'll handle JSON parsing manually
  : (llm as ChatOpenAI).withStructuredOutput(qa, {
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
  sessionId: string
) {
  console.log('--- RAG SERVICE STARTED ---------------');
  console.log('📝 Question:', question);
  console.log('🆔 SessionId:', sessionId);
  console.log('🔗 RepoUrl:', repoUrl);

  const repoId = generateUniqueRepoId(repoUrl);
  const retriever = await createCodeRetriever(repoId, 8);

  // --- STEP 1: Define Prompt -----------------------------------------------
  // --- PROVIDE PAST CONVERSATIONS AS CONTEXT ---------
  const sessionHistory = await Conversation.findOne({ sessionId }); // Search for n number of the most recent interactions based on the sessionId

  console.log('📚 Session history found:', !!sessionHistory);
  console.log('💬 Number of messages:', sessionHistory?.messages?.length || 0);

  const previousContext = formatConversationHistory(
    sessionHistory?.messages || []
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
  const USERPROMPT = useLocalModel
    ? `Use the following pieces of context to answer the question at the end.

    Context: {context}\n\n

    Question: {question}
    
    CRITICAL: You MUST respond with a valid JSON object in this EXACT format. Do not include any text before or after the JSON:
    {
      "answer": "your detailed answer here explaining the code and concepts",
      "citations": [
        {
          "file": "path/to/file.ts",
          "startLine": 10,
          "endLine": 20,
          "snippet": "relevant code snippet"
        }
      ]
    }
    
    Remember: 
    - Include the complete file path in citations
    - Use actual line numbers from the context
    - Include relevant code snippets
    - Answer should be comprehensive and technical
    
    JSON Response:`
    : `Use the following pieces of context to answer the question at the end.

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
    response: Annotation<typeof qa.shape>,
  });

  // --- STEP 3: Define Application Steps ------------------------------------
  // https://v03.api.js.langchain.com/classes/_langchain_openai.ChatOpenAI.html
  // Streaming; Metadata - tokens

  const retrieve = async (state: typeof InputState.State) => {
    try {
      console.log(`Attempting to retrieve docs for repo: ${repoId}`);

      const retrievedDocs = await retriever.invoke(state.question);

      return { context: retrievedDocs }; // merges into  WorkingState, thus the WorkingState has now access to both question + context
    } catch (err) {
      throw new Error('VECTOR_DB_DOWN');
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
      if (!process.env.COHERE_API_KEY) {
        console.error('COHERE_API_KEY is missing!');
        return { context: state.context }; // Return original docs
      }

      // https://docs.cohere.com/v2/docs/models
      const reranker = new CohereRerank({
        apiKey: process.env.COHERE_API_KEY,
        model: 'rerank-v3.5',
        topN: Math.min(5, state.context.length),
      });

      console.log(`Reranking ${state.context.length} documents...`);

      const ranks = await reranker.rerank(state.context, state.question);
      // console.log('--- ranks ---------');
      // console.log(ranks);

      if (!ranks || !Array.isArray(ranks)) {
        console.error('Reranker returned invalid result: ', ranks);
      }

      const topDocs = ranks.map((r: any) => state.context[r.index]);
      // console.log('--- topDocs ---------');
      // console.log(topDocs);

      return { context: topDocs };
    } catch (err) {
      console.error('Error during reranking:', err);
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
    const answerChain = promptTemplate.pipe(structuredLlm as any);
    const rawResponse = await answerChain.invoke({
      question: state.question,
      context: promptBody,
    });

    console.log('--- rawResponse ------------');
    console.log(rawResponse);

    // Handle different response formats based on model type
    let response: QAResponse;
    if (useLocalModel) {
      // For Ollama, parse JSON response manually
      const answerText =
        typeof rawResponse === 'string'
          ? rawResponse
          : (rawResponse as any).content ||
            (rawResponse as any).text ||
            (rawResponse as any).answer ||
            String(rawResponse);

      try {
        // Enhanced JSON extraction with multiple parsing strategies
        let parsedResponse: Partial<QAResponse> | null = null;

        // Strategy 1: Look for complete JSON object
        const jsonMatch = answerText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsedResponse = JSON.parse(jsonMatch[0]) as QAResponse;
          } catch (e) {
            console.warn('JSON match found but failed to parse:', e);
          }
        }

        // Strategy 2: Look for structured markers if JSON parsing failed
        if (!parsedResponse || !parsedResponse.answer) {
          const answerMatch =
            answerText.match(/(?:answer|response):\s*"([^"]+)"/i) ||
            answerText.match(/(?:answer|response):\s*([^\n]+)/i);
          const citationsMatch = answerText.match(/citations:\s*\[(.*?)\]/is);

          if (answerMatch) {
            parsedResponse = {
              answer: answerMatch[1].trim(),
              citations: citationsMatch
                ? (citationsMatch[1]
                    .split(',')
                    .map((c: string) => c.trim().replace(/['"]/g, '')) as any[])
                : [],
            };
          }
        }

        if (parsedResponse && parsedResponse.answer) {
          response = {
            answer: parsedResponse.answer,
            citations: Array.isArray(parsedResponse.citations)
              ? parsedResponse.citations
              : [],
          };
        } else {
          // Fallback if no structured data found
          response = {
            answer: answerText,
            citations: [],
          };
        }
      } catch (parseError) {
        console.warn(
          'Failed to parse Ollama response, using raw text:',
          parseError
        );
        response = {
          answer: answerText,
          citations: [],
        };
      }
    } else {
      // OpenAI with structured output
      response = rawResponse as unknown as QAResponse;
    }

    console.log('--- parsed response ------------');
    console.log(response);

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
      }
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
    { runName: 'ask-question', configurable: { repoId } }
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
