// Agentic v1.1 planner: tool descriptions that state each tool's role and when not to use it.
import { z } from 'zod';
import type { RepoSnapshot } from '../tools/index.js';
import { FINISH_TOOL, type PlannerToolSpec } from './planner.js';

const globs = z
  .array(z.string())
  .describe('Optional globs over repo-relative paths, e.g. ["server/**/*.ts"]. Leave empty to search everywhere.');

const RESEARCH_TOOLS: PlannerToolSpec[] = [
  {
    name: 'semanticSearch',
    description:
      'DISCOVERY. Embedding search over the indexed code (the same retrieval RAG uses). Use it when you do not yet ' +
      'know which files or names are involved: conceptual "how / where / why" questions, or a new part of the ' +
      'question. Describe the behavior in plain language. Not for exact strings or for following a symbol you ' +
      'already know.',
    schema: z.object({
      query: z.string().describe('Plain-language description of the code you are looking for.'),
      k: z.number().int().min(1).max(8).optional().describe('Maximum results (default 8).'),
    }),
  },
  {
    name: 'grepSearch',
    description:
      'EXACT TEXT. Literal (or regex) search across every repository file, including config, JSON, env examples, ' +
      'and docs. Use it for a specific string, config key, environment variable, route path, error message, or a ' +
      'partial name, and to learn the exact spelling of an identifier before using findDefinition or findReferences.',
    schema: z.object({
      pattern: z.string().describe('Text to find. Literal unless regex is true.'),
      regex: z.boolean().optional(),
      caseSensitive: z.boolean().optional().describe('Default false.'),
      include: globs.optional(),
      maxResults: z.number().int().min(1).max(200).optional().describe('Maximum matching lines (default 50).'),
      contextLines: z.number().int().min(0).max(10).optional().describe('Lines of context around matches (default 2).'),
    }),
  },
  {
    name: 'readFile',
    description:
      'READ. Exact lines of a file you already know. Use it after another tool points you to a file: a whole small ' +
      'file, a function body, or the code around a match. The path must come from the file list or earlier results.',
    schema: z.object({
      path: z.string().describe('Repo-relative path, e.g. "server/src/app.ts".'),
      startLine: z.number().int().min(1).optional(),
      endLine: z.number().int().min(1).optional().describe('Inclusive. At most 400 lines are returned per call.'),
    }),
  },
  {
    name: 'findDefinition',
    description:
      'JUMP TO DECLARATION of a known exact TypeScript/JavaScript name (function, class, method, property, ' +
      'interface, type, enum, module-level variable), including its JSDoc. Use it when earlier evidence shows the ' +
      'exact name and you need its implementation. Not for discovery: if you are unsure of the name, use grepSearch ' +
      'or semanticSearch first.',
    schema: z.object({
      symbol: z.string().describe('Exact identifier ("answerQuestion") or Class.member ("AuthService.verify").'),
      kind: z.enum(['function', 'class', 'method', 'property', 'interface', 'type', 'enum', 'variable']).optional(),
    }),
  },
  {
    name: 'findReferences',
    description:
      'TRACE USAGES of one known exact identifier: call sites, imports, and JSX usage across TS/JS files. Use it only ' +
      'after earlier evidence shows the exact name and you need to know who uses it. It is not a search tool: it ' +
      'rejects descriptions and phrases, rejects names that do not occur in the repository, and excludes the ' +
      'declaration itself (use findDefinition for that). Leave include empty unless you deliberately want to ' +
      'restrict the usages to certain files; restricting to the declaring file usually finds nothing.',
    schema: z.object({
      symbol: z.string().describe('One exact identifier copied from earlier evidence, e.g. "cloneRepo".'),
      includeDeclarations: z.boolean().optional(),
      include: globs.optional(),
      maxResults: z.number().int().min(1).max(200).optional(),
      contextLines: z.number().int().min(0).max(10).optional(),
    }),
  },
];

const subgoal = z.number().int().min(1).describe('Number of the subgoal this call investigates.');

export const PLANNER_TOOLS_V1_1: PlannerToolSpec[] = [
  ...RESEARCH_TOOLS.map((t) => ({ ...t, schema: t.schema.extend({ subgoal }) })),
  {
    name: FINISH_TOOL,
    description:
      'Declare that every subgoal is covered by gathered evidence. Map each subgoal to the evidence IDs that answer ' +
      'it. A subgoal you investigated but could not answer may be listed as unresolved instead. Finish is rejected ' +
      'while any subgoal is neither covered nor investigated-and-unresolved. The answer is written in a separate step.',
    schema: z.object({
      reason: z.string().describe('One sentence on why the evidence is sufficient.'),
      coverage: z
        .array(z.object({ subgoal: z.number().int().min(1), evidenceIds: z.array(z.string()).describe('e.g. ["E2", "E5"]') }))
        .describe('One entry per covered subgoal.'),
      unresolved: z
        .array(z.object({ subgoal: z.number().int().min(1), reason: z.string() }))
        .optional()
        .describe('Subgoals already investigated with tool calls whose answer is not in the repository evidence.'),
    }),
  },
];

const MAX_LISTED_FILES = 400;

export function plannerSystemPromptV1_1(
  snapshot: RepoSnapshot,
  budget: { toolCallsUsed: number; maxToolCalls: number; turnsLeft: number },
  subgoals = '',
): string {
  const files = snapshot.listFiles();
  const listed = files.slice(0, MAX_LISTED_FILES).join('\n');
  const more = files.length > MAX_LISTED_FILES ? `\n… and ${files.length - MAX_LISTED_FILES} more files` : '';
  return `You are a code investigation agent. You gather evidence from one repository snapshot so that a separate step can answer the user's question with citations.

Repository: ${snapshot.repoId} at commit ${snapshot.commitSha.slice(0, 7)}.

How to work:
- Each turn, call exactly one tool. Choose it from the question, the evidence gathered so far, and earlier tool results.
- Tool roles: semanticSearch discovers where to look; grepSearch finds exact text and real spellings; readFile reads code you have located; findDefinition opens the declaration of a name you have seen; findReferences traces who uses a name you have seen.
- Only pass exact names you have seen in evidence to findDefinition or findReferences. Never guess names.
- Evidence items are labeled E1, E2, ... Do not re-fetch evidence you already have; follow up on it instead.
- Tag every tool call with the number of the subgoal it investigates. Having some relevant evidence is not enough: each subgoal needs evidence of its own.
- Call ${FINISH_TOOL} once every subgoal is covered, mapping each to the evidence IDs that answer it. Do not write the answer yourself.

${subgoals ? `${subgoals}\n\n` : ''}Budget: ${budget.toolCallsUsed} of ${budget.maxToolCalls} tool calls used; at most ${budget.turnsLeft} turns left. Repeated calls with the same arguments are rejected. Spread the budget across subgoals.

Repository files:
${listed}${more}`;
}
