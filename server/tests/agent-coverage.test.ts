import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AIMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import { tempDir, writeFiles } from './helpers/fixtures.js';
import { RepoSnapshot } from '../src/features/tools/index.js';
import { runAgent, type AgentOptions } from '../src/features/agent/agent.service.js';
import type { Planner } from '../src/features/agent/planner.js';
import type { Answerer } from '../src/features/agent/answerer.js';
import type { Decomposer } from '../src/features/agent/decomposer.js';
import { normalizeSubgoals } from '../src/features/agent/decomposer.js';
import { PLANNER_TOOLS_V1_1 } from '../src/features/agent/planner-v1_1.js';

const SHA = 'dd'.repeat(20);
const root = tempDir('devai-snap-');
writeFiles(root, {
  'src/auth.ts': 'export function verify(token: string) {\n  return token.length > 0;\n}\n',
  'src/config.ts': 'export const PORT = Number(process.env.PORT ?? 3000);\n',
});
const snap = new RepoSnapshot('acme', SHA, root);

let seq = 0;
const call = (name: string, args: Record<string, unknown>) =>
  new AIMessage({ content: '', tool_calls: [{ id: `k${++seq}`, name, args, type: 'tool_call' }] });

type Step = AIMessage | ((messages: BaseMessage[]) => AIMessage);
function scripted(steps: Step[]) {
  const seen: BaseMessage[][] = [];
  const planner: Planner = async (messages) => {
    seen.push(messages);
    const step = steps[Math.min(seen.length - 1, steps.length - 1)];
    return typeof step === 'function' ? step(messages) : step;
  };
  return { planner, seen };
}

const answerer: Answerer = async () => ({ draft: { answer: 'ok', citations: [] }, promptTokens: 1, completionTokens: 1 });
const TWO: Decomposer = async () => ({ subgoals: ['How are tokens verified?', 'Which port does the server use?'] });

const run = (planner: Planner, options: AgentOptions = {}) =>
  runAgent(
    { snapshot: snap, question: 'How are tokens verified, and which port does the server use?', type: 'Find' },
    { profile: 'agentic-v1.1', planner, answerer, decomposer: TWO, sleep: async () => {}, ...options },
  );

const lastToolText = (messages: BaseMessage[]) => String(messages.at(-1)?.content ?? '');

test('finish is rejected while a subgoal has no evidence, even though other evidence exists', async () => {
  const { planner, seen } = scripted([
    call('findDefinition', { symbol: 'verify', subgoal: 1 }),
    call('finish', { reason: 'found verify', coverage: [{ subgoal: 1, evidenceIds: ['E1'] }] }),
    call('grepSearch', { pattern: 'PORT', subgoal: 2 }),
    call('finish', { reason: 'both parts', coverage: [{ subgoal: 1, evidenceIds: ['E1'] }, { subgoal: 2, evidenceIds: ['E2'] }] }),
  ]);
  const result = await run(planner);

  assert.equal(result.trace.terminationReason, 'sufficient_evidence');
  assert.deepEqual(
    result.trace.finishAttempts.map((f) => [f.accepted, f.missing]),
    [
      [false, [2]],
      [true, []],
    ],
  );
  const afterRejection = lastToolText(seen[2]);
  assert.match(afterRejection, /finish rejected: 1 subgoal/);
  assert.match(afterRejection, /2\. Which port does the server use\? \(not investigated yet\)/);
  assert.deepEqual(
    result.trace.subgoals!.map((s) => [s.index, s.status, s.coveredBy, s.toolCalls]),
    [
      [1, 'covered', ['E1'], 1],
      [2, 'covered', ['E2'], 1],
    ],
  );
  assert.deepEqual(result.trace.steps.map((s) => s.subgoal), [1, 2]);
});

test('coverage must point at evidence that was actually gathered', async () => {
  const { planner } = scripted([
    call('findDefinition', { symbol: 'verify', subgoal: 1 }),
    call('finish', { reason: 'r', coverage: [{ subgoal: 1, evidenceIds: ['E1'] }, { subgoal: 2, evidenceIds: ['E9'] }] }),
  ]);
  const result = await run(planner, { limits: { maxNoProgressTurns: 2 } });
  const first = result.trace.finishAttempts[0];
  assert.equal(first.accepted, false);
  assert.deepEqual(first.missing, [2]);
  assert.match(first.problems.join(), /E9 is not a gathered evidence ID/);
});

test('a subgoal can be declared unresolved only after a tool call investigated it', async () => {
  const { planner } = scripted([
    call('findDefinition', { symbol: 'verify', subgoal: 1 }),
    call('finish', { reason: 'r', coverage: [{ subgoal: 1, evidenceIds: ['E1'] }], unresolved: [{ subgoal: 2, reason: 'not in repo' }] }),
    call('grepSearch', { pattern: 'LISTEN_ADDR', subgoal: 2 }),
    call('finish', { reason: 'r', coverage: [{ subgoal: 1, evidenceIds: ['E1'] }], unresolved: [{ subgoal: 2, reason: 'not in repo' }] }),
  ]);
  const result = await run(planner);
  assert.equal(result.trace.finishAttempts[0].accepted, false);
  assert.match(result.trace.finishAttempts[0].problems.join(), /subgoal 2 cannot be marked unresolved before any tool call/);
  assert.equal(result.trace.finishAttempts[1].accepted, true);
  assert.equal(result.trace.terminationReason, 'sufficient_evidence');
  assert.deepEqual(
    result.trace.subgoals!.map((s) => [s.status, s.unresolved]),
    [
      ['covered', null],
      ['unresolved', 'not in repo'],
    ],
  );
});

test('repeated rejected finishes are bounded by the no-progress limit', async () => {
  const { planner, seen } = scripted([call('finish', { reason: 'nothing needed', coverage: [] })]);
  const result = await run(planner);
  assert.equal(result.trace.terminationReason, 'no_progress');
  assert.equal(result.trace.finishAttempts.length, 3);
  assert.ok(result.trace.finishAttempts.every((f) => !f.accepted));
  assert.equal(seen.length, 3);
  assert.deepEqual(result.trace.subgoals!.map((s) => s.status), ['open', 'open']);
});

test('the subgoal tag is stripped before execution, so it cannot affect tool arguments or duplicate detection', async () => {
  const received: Record<string, unknown>[] = [];
  const { planner } = scripted([
    call('grepSearch', { pattern: 'PORT', subgoal: 2 }),
    call('grepSearch', { pattern: 'PORT', subgoal: 1 }),
    call('finish', { reason: 'r', coverage: [{ subgoal: 1, evidenceIds: ['E1'] }, { subgoal: 2, evidenceIds: ['E1'] }] }),
  ]);
  const result = await run(planner, {
    tools: {
      grepSearch: async (s, args) => {
        received.push(args);
        return { tool: 'grepSearch', truncated: false, evidence: [s.evidence('src/config.ts', 1, 1, 'grepSearch')] };
      },
    },
  });
  assert.deepEqual(received, [{ pattern: 'PORT' }]);
  assert.deepEqual(result.trace.steps.map((s) => [s.status, s.subgoal, 'subgoal' in s.args]), [
    ['ok', 2, false],
    ['duplicate', 1, false],
  ]);
  assert.equal(result.trace.terminationReason, 'sufficient_evidence');
});

test('with a single subgoal every call is tagged automatically', async () => {
  const { planner } = scripted([
    call('findDefinition', { symbol: 'verify' }),
    call('finish', { reason: 'r', coverage: [{ subgoal: 1, evidenceIds: ['E1'] }] }),
  ]);
  const result = await run(planner, { decomposer: async ({ question }) => ({ subgoals: [question] }) });
  assert.equal(result.trace.steps[0].subgoal, 1);
  assert.equal(result.trace.subgoals!.length, 1);
  assert.equal(result.trace.terminationReason, 'sufficient_evidence');
});

test('each planner turn shows the subgoals and the evidence gathered for each', async () => {
  const { planner, seen } = scripted([
    call('findDefinition', { symbol: 'verify', subgoal: 1 }),
    call('finish', { reason: 'r', coverage: [{ subgoal: 1, evidenceIds: ['E1'] }], unresolved: [] }),
  ]);
  await run(planner, { limits: { maxNoProgressTurns: 1 } });
  const system = (i: number) => String((seen[i][0] as SystemMessage).content);
  assert.match(system(0), /1\. How are tokens verified\? \[0 tool call\(s\); not investigated yet\]/);
  assert.match(system(1), /1\. How are tokens verified\? \[1 tool call\(s\); evidence so far: E1\]/);
  assert.match(system(1), /2\. Which port does the server use\? \[0 tool call\(s\); not investigated yet\]/);
});

test('a failed decomposition falls back to the question as the only subgoal and is recorded', async () => {
  const { planner } = scripted([
    call('findDefinition', { symbol: 'verify' }),
    call('finish', { reason: 'r', coverage: [{ subgoal: 1, evidenceIds: ['E1'] }] }),
  ]);
  const result = await run(planner, {
    decomposer: async () => {
      throw new Error('bad request');
    },
  });
  assert.deepEqual(result.trace.subgoals!.map((s) => s.text), ['How are tokens verified, and which port does the server use?']);
  assert.match(result.trace.errors.join(), /decompose: .*bad request/);
  assert.equal(result.trace.llmCalls[0].phase, 'decompose');
  assert.equal(result.trace.terminationReason, 'sufficient_evidence');
});

test('decomposer output is trimmed, deduplicated, and capped', () => {
  assert.deepEqual(normalizeSubgoals([' a ', 'A', '', 'b', 'c', 'd', 'e', 'f'], 'q'), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(normalizeSubgoals([], 'q'), ['q']);
  assert.deepEqual(normalizeSubgoals('nope', 'q'), ['q']);
});

test('agentic-v1 has no decomposition step and accepts finish without coverage', async () => {
  let decomposed = 0;
  const { planner } = scripted([call('finish', { reason: 'enough' })]);
  const result = await run(planner, {
    profile: 'agentic-v1',
    decomposer: async () => {
      decomposed++;
      return { subgoals: ['x'] };
    },
  });
  assert.equal(decomposed, 0);
  assert.equal(result.trace.subgoals, null);
  assert.deepEqual(result.trace.finishAttempts, []);
  assert.equal(result.trace.terminationReason, 'sufficient_evidence');
});

test('v1.1 research tools take a subgoal tag and finish takes a coverage map', () => {
  for (const t of PLANNER_TOOLS_V1_1) {
    const keys = Object.keys(t.schema.shape);
    if (t.name === 'finish') assert.deepEqual(keys, ['reason', 'coverage', 'unresolved']);
    else assert.ok(keys.includes('subgoal'), t.name);
  }
});
