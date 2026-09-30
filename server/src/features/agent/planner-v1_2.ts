// Agentic v1.2 planner: each tool call names every subgoal it serves, evidence counts only for those
// subgoals, and findReferences always searches the whole repository.
import { z } from 'zod';
import type { RepoSnapshot } from '../tools/index.js';
import { FINISH_TOOL, type PlannerToolSpec } from './planner.js';
import { RESEARCH_TOOLS_V1_1 } from './planner-v1_1.js';

const findReferences: PlannerToolSpec = {
  name: 'findReferences',
  description:
    'TRACE USAGES of one known exact identifier across the whole repository: call sites, imports, and JSX usage in ' +
    'TS/JS files. Use it only after earlier evidence shows the exact name and you need to know who uses it. It is ' +
    'not a search tool and not a file reader: it rejects descriptions, phrases, and names that do not occur in the ' +
    'repository, and it excludes the declaration itself (use findDefinition for that). To inspect one specific ' +
    'file, use readFile.',
  schema: z.object({
    symbol: z.string().describe('One exact identifier copied from earlier evidence, e.g. "cloneRepo".'),
    includeDeclarations: z.boolean().optional(),
    maxResults: z.number().int().min(1).max(200).optional(),
    contextLines: z.number().int().min(0).max(10).optional(),
  }),
};

const subgoals = z
  .array(z.number().int().min(1))
  .min(1)
  .describe('Numbers of every subgoal this call is meant to answer. Its evidence can only support these subgoals.');

export const PLANNER_TOOLS_V1_2: PlannerToolSpec[] = [
  ...RESEARCH_TOOLS_V1_1.map((t) => (t.name === 'findReferences' ? findReferences : t)).map((t) => ({
    ...t,
    schema: t.schema.extend({ subgoals }),
  })),
  {
    name: FINISH_TOOL,
    description:
      'Declare that every subgoal is covered. Map each subgoal to the evidence IDs that answer it; an evidence ID ' +
      'can support a subgoal only if the tool call that produced it was tagged with that subgoal. A subgoal you ' +
      'investigated with a tagged call but could not answer may be listed as unresolved instead. Finish is rejected ' +
      'while any subgoal is neither covered nor investigated-and-unresolved. The answer is written in a separate step.',
    schema: z.object({
      reason: z.string().describe('One sentence on why the evidence is sufficient.'),
      coverage: z
        .array(z.object({ subgoal: z.number().int().min(1), evidenceIds: z.array(z.string()).describe('e.g. ["E2", "E5"]') }))
        .describe('One entry per covered subgoal.'),
      unresolved: z
        .array(z.object({ subgoal: z.number().int().min(1), reason: z.string() }))
        .optional()
        .describe('Subgoals already investigated with tagged tool calls whose answer is not in the repository.'),
    }),
  },
];

const MAX_LISTED_FILES = 400;

export function plannerSystemPromptV1_2(
  snapshot: RepoSnapshot,
  budget: { toolCallsUsed: number; maxToolCalls: number; turnsLeft: number },
  subgoalSection = '',
): string {
  const files = snapshot.listFiles();
  const listed = files.slice(0, MAX_LISTED_FILES).join('\n');
  const more = files.length > MAX_LISTED_FILES ? `\n… and ${files.length - MAX_LISTED_FILES} more files` : '';
  return `You are a code investigation agent. You gather evidence from one repository snapshot so that a separate step can answer the user's question with citations.

Repository: ${snapshot.repoId} at commit ${snapshot.commitSha.slice(0, 7)}.

How to work:
- Each turn, call exactly one tool. Choose it from the question, the evidence gathered so far, and earlier tool results.
- Tool roles: semanticSearch discovers where to look; grepSearch finds exact text and real spellings; readFile reads code you have located, including one specific file; findDefinition opens the declaration of a name you have seen; findReferences traces who uses a name you have seen, across the whole repository.
- Only pass exact names you have seen in evidence to findDefinition or findReferences. Never guess names.
- Evidence items are labeled E1, E2, ... Do not re-fetch evidence you already have; follow up on it instead.
- Tag every tool call with the subgoal numbers it is meant to answer. One call may serve several subgoals when it genuinely targets all of them. Evidence supports only the subgoals its call was tagged with.
- Call ${FINISH_TOOL} once every subgoal is covered, mapping each to evidence from calls tagged with it. Do not write the answer yourself.

${subgoalSection ? `${subgoalSection}\n\n` : ''}Budget: ${budget.toolCallsUsed} of ${budget.maxToolCalls} tool calls used; at most ${budget.turnsLeft} turns left. Repeated calls with the same arguments are rejected.

Repository files:
${listed}${more}`;
}
