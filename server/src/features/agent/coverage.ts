// Subgoal coverage: finish is accepted only when every subgoal is mapped to evidence, or was actually
// investigated and declared unresolved.
// 'any' (agentic-v1.1): any gathered evidence may cover any subgoal.
// 'tagged' (agentic-v1.2): evidence may cover only subgoals tagged on the tool call that produced it.
import type { SubgoalTrace, ToolStepTrace } from './types.js';

export type CoverageMode = 'any' | 'tagged';

// Steps that ran a tool (as opposed to being refused before running).
const ATTEMPTED = new Set<ToolStepTrace['status']>(['ok', 'error', 'timeout']);

export type FinishCheck = { accepted: boolean; missing: number[]; problems: string[]; subgoals: SubgoalTrace[] };

export const stepTags = (s: ToolStepTrace): number[] => s.subgoals ?? (s.subgoal !== undefined ? [s.subgoal] : []);

// In 'tagged' mode only calls that actually ran count, so re-tagging a duplicate cannot move evidence between subgoals.
export function taggedEvidence(steps: ToolStepTrace[], subgoal: number, mode: CoverageMode = 'any'): string[] {
  const ids = new Set<string>();
  for (const s of steps) {
    if (!stepTags(s).includes(subgoal)) continue;
    if (mode === 'tagged' && !ATTEMPTED.has(s.status)) continue;
    for (const id of s.evidenceIds) ids.add(id);
  }
  return [...ids];
}

export function subgoalStatus(texts: string[], steps: ToolStepTrace[], mode: CoverageMode = 'any'): SubgoalTrace[] {
  return texts.map((text, i) => ({
    index: i + 1,
    text,
    toolCalls: steps.filter((s) => stepTags(s).includes(i + 1) && ATTEMPTED.has(s.status)).length,
    gatheredEvidenceIds: taggedEvidence(steps, i + 1, mode),
    coveredBy: [],
    unresolved: null,
    status: 'open',
  }));
}

// Validates the planner's finish arguments against the subgoals, gathered evidence, and tool history.
export function checkFinish(
  args: unknown,
  texts: string[],
  steps: ToolStepTrace[],
  evidenceIds: Set<string>,
  mode: CoverageMode = 'any',
): FinishCheck {
  const subgoals = subgoalStatus(texts, steps, mode);
  const problems: string[] = [];
  const a = (args ?? {}) as { coverage?: unknown; unresolved?: unknown };
  const inRange = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= texts.length;

  for (const entry of Array.isArray(a.coverage) ? a.coverage : []) {
    const n = (entry as { subgoal?: unknown })?.subgoal;
    if (!inRange(n)) continue;
    const sg = subgoals[n - 1];
    const ids = (entry as { evidenceIds?: unknown }).evidenceIds;
    for (const id of Array.isArray(ids) ? ids.map(String) : []) {
      if (!evidenceIds.has(id)) {
        problems.push(`subgoal ${n}: ${id} is not a gathered evidence ID`);
      } else if (mode === 'tagged' && !sg.gatheredEvidenceIds.includes(id)) {
        problems.push(`subgoal ${n}: ${id} came from a call not tagged with subgoal ${n}`);
      } else if (!sg.coveredBy.includes(id)) {
        sg.coveredBy.push(id);
      }
    }
  }
  for (const entry of Array.isArray(a.unresolved) ? a.unresolved : []) {
    const n = (entry as { subgoal?: unknown })?.subgoal;
    if (!inRange(n)) continue;
    const sg = subgoals[n - 1];
    if (sg.coveredBy.length) continue;
    if (sg.toolCalls === 0) {
      problems.push(`subgoal ${n} cannot be marked unresolved before any tool call has investigated it`);
      continue;
    }
    const reason = (entry as { reason?: unknown }).reason;
    sg.unresolved = typeof reason === 'string' && reason.trim() ? reason.trim() : 'unresolved';
  }
  for (const sg of subgoals) sg.status = sg.coveredBy.length ? 'covered' : sg.unresolved ? 'unresolved' : 'open';
  const missing = subgoals.filter((s) => s.status === 'open').map((s) => s.index);
  return { accepted: missing.length === 0, missing, problems, subgoals };
}

export function rejectionMessage(check: FinishCheck, mode: CoverageMode = 'any'): string {
  const lines = check.subgoals
    .filter((s) => s.status === 'open')
    .map((s) => `  ${s.index}. ${s.text}${s.gatheredEvidenceIds.length ? ` (evidence gathered for it: ${s.gatheredEvidenceIds.join(', ')})` : ' (not investigated yet)'}`);
  const how =
    mode === 'tagged'
      ? 'Investigate each open subgoal with a tool call tagged with its number, then call finish again, mapping every ' +
        'subgoal only to evidence from calls tagged with it. A subgoal may be listed as unresolved only after a tagged tool call has investigated it.'
      : 'Investigate each open subgoal with a tool call tagged with its number, then call finish again, mapping every ' +
        'subgoal to the evidence IDs that answer it. A subgoal may be listed as unresolved only after a tool call has investigated it.';
  return [
    `finish rejected: ${check.missing.length} subgoal(s) have no supporting evidence mapped to them:`,
    ...lines,
    ...check.problems.map((p) => `  - ${p}`),
    how,
  ].join('\n');
}

export function subgoalsPromptSection(texts: string[], steps: ToolStepTrace[], mode: CoverageMode = 'any'): string {
  const rows = subgoalStatus(texts, steps, mode).map((s) => {
    const ev = s.gatheredEvidenceIds.length ? `evidence so far: ${s.gatheredEvidenceIds.join(', ')}` : 'not investigated yet';
    return `${s.index}. ${s.text} [${s.toolCalls} tool call(s); ${ev}]`;
  });
  return `Subgoals (a complete answer must cover all of them):\n${rows.join('\n')}`;
}
