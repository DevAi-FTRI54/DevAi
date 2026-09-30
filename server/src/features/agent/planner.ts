// Tool schemas and prompts for the planning step. The planner only chooses the next tool (or finish);
// it never writes the answer, file paths for citations, or snippets.
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import type { AIMessage, BaseMessage } from '@langchain/core/messages';
import type { Callbacks } from '@langchain/core/callbacks/manager';
import type { RepoSnapshot } from '../tools/index.js';

export const FINISH_TOOL = 'finish';

const globs = z.array(z.string()).describe('Globs over repo-relative paths, e.g. ["server/**/*.ts"]. Bare names like "*.json" match anywhere.');

export const PLANNER_TOOLS = [
  {
    name: 'semanticSearch',
    description:
      'Embedding search over the indexed code (the same retrieval RAG uses). Best for conceptual questions ' +
      '("how does X work", "where is Y handled") when you do not know exact names.',
    schema: z.object({
      query: z.string().describe('A natural-language description of the code you are looking for.'),
      k: z.number().int().min(1).max(8).optional().describe('Maximum results (default 8).'),
    }),
  },
  {
    name: 'grepSearch',
    description:
      'Exact text or regex search across repository files. Best for identifiers, string literals, config keys, ' +
      'environment variables, routes, and error messages.',
    schema: z.object({
      pattern: z.string(),
      regex: z.boolean().optional().describe('Treat pattern as a JavaScript regex (default: literal).'),
      caseSensitive: z.boolean().optional().describe('Default false.'),
      include: globs.optional(),
      maxResults: z.number().int().min(1).max(200).optional().describe('Maximum matching lines (default 50).'),
      contextLines: z.number().int().min(0).max(10).optional().describe('Lines of context around matches (default 2).'),
    }),
  },
  {
    name: 'readFile',
    description: 'Read exact lines of one file. Use to see a whole small file or the surrounding context of a match.',
    schema: z.object({
      path: z.string().describe('Repo-relative path, e.g. "server/src/app.ts".'),
      startLine: z.number().int().min(1).optional(),
      endLine: z.number().int().min(1).optional().describe('Inclusive. At most 400 lines are returned per call.'),
    }),
  },
  {
    name: 'findDefinition',
    description:
      'Find where a TypeScript/JavaScript symbol is declared (function, class, method, property, interface, type, ' +
      'enum, or module-level variable), including its JSDoc.',
    schema: z.object({
      symbol: z.string().describe('An identifier ("answerQuestion") or Class.member ("AuthService.verify").'),
      kind: z.enum(['function', 'class', 'method', 'property', 'interface', 'type', 'enum', 'variable']).optional(),
    }),
  },
  {
    name: 'findReferences',
    description: 'Find the lines where an identifier is used (call sites, imports, JSX usage). Name-based, excludes comments and strings.',
    schema: z.object({
      symbol: z.string().describe('A single identifier.'),
      includeDeclarations: z.boolean().optional(),
      include: globs.optional(),
      maxResults: z.number().int().min(1).max(200).optional(),
      contextLines: z.number().int().min(0).max(10).optional(),
    }),
  },
  {
    name: FINISH_TOOL,
    description:
      'Declare that the gathered evidence is sufficient to answer the question completely, or that further ' +
      'tool calls are unlikely to help. The answer is written in a separate step from the gathered evidence.',
    schema: z.object({
      reason: z.string().describe('One sentence on why the evidence is sufficient (or why more searching will not help).'),
    }),
  },
];

const MAX_LISTED_FILES = 400;

export function plannerSystemPrompt(
  snapshot: RepoSnapshot,
  budget: { toolCallsUsed: number; maxToolCalls: number; turnsLeft: number },
): string {
  const files = snapshot.listFiles();
  const listed = files.slice(0, MAX_LISTED_FILES).join('\n');
  const more = files.length > MAX_LISTED_FILES ? `\n… and ${files.length - MAX_LISTED_FILES} more files` : '';
  return `You are a code investigation agent. You gather evidence from one repository snapshot so that a separate step can answer the user's question with citations.

Repository: ${snapshot.repoId} at commit ${snapshot.commitSha.slice(0, 7)}.

How to work:
- Each turn, call exactly one tool. Choose it from the question, the evidence gathered so far, and earlier tool results.
- Evidence items are labeled E1, E2, ... Do not re-fetch evidence you already have; follow up on it instead (read around a match, find a definition, trace references).
- For multi-part or cross-file questions, make sure every part is covered before finishing.
- Prefer precise tools (grepSearch, findDefinition, findReferences, readFile) once you know names or paths; use semanticSearch to discover where to look.
- Call ${FINISH_TOOL} as soon as the evidence is sufficient, or when more calls are unlikely to help. Do not write the answer yourself.

Budget: ${budget.toolCallsUsed} of ${budget.maxToolCalls} tool calls used; at most ${budget.turnsLeft} turns left. Repeated calls with the same arguments are rejected.

Repository files:
${listed}${more}`;
}

export type Planner = (
  messages: BaseMessage[],
  options: { signal: AbortSignal; callbacks?: Callbacks },
) => Promise<AIMessage>;

export type PlannerToolSpec = { name: string; description: string; schema: z.AnyZodObject };

export function createDefaultPlanner(tools: PlannerToolSpec[] = PLANNER_TOOLS, model = 'gpt-4o-mini'): Planner {
  const llm = new ChatOpenAI({ model, temperature: 0, maxRetries: 2, apiKey: process.env.OPENAI_API_KEY });
  const bound = llm.bindTools(tools, { tool_choice: 'required', parallel_tool_calls: false });
  return (messages, { signal, callbacks }) => bound.invoke(messages, { signal, callbacks, runName: 'agent-plan' });
}
