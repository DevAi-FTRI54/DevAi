import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AIMessage, type BaseMessage } from '@langchain/core/messages';
import { tempDir, writeFiles } from './helpers/fixtures.js';
import { RepoSnapshot } from '../src/features/tools/index.js';
import { runAgent, DEFAULT_AGENT_PROFILE, type AgentOptions } from '../src/features/agent/agent.service.js';
import type { Planner } from '../src/features/agent/planner.js';
import type { Answerer } from '../src/features/agent/answerer.js';
import type { Decomposer } from '../src/features/agent/decomposer.js';
import type { ToolImpl } from '../src/features/agent/tool-runtime.js';
import { PLANNER_TOOLS_V1_2 } from '../src/features/agent/planner-v1_2.js';
import { PLANNER_TOOLS_V1_1 } from '../src/features/agent/planner-v1_1.js';

const SHA = 'ee'.repeat(20);
const root = tempDir('devai-snap-');
writeFiles(root, {
  'src/auth.ts': 'export function verify(token: string) {\n  return token.length > 0;\n}\n',
  'src/config.ts': 'export const PORT = Number(process.env.PORT ?? 3000);\n',
  'src/app.ts': "import { verify } from './auth';\nverify('x');\n",
});
const snap = new RepoSnapshot('acme', SHA, root);

let seq = 0;
const call = (name: string, args: Record<string, unknown>) =>
  new AIMessage({ content: '', tool_calls: [{ id: `v${++seq}`, name, args, type: 'tool_call' }] });

function scripted(steps: AIMessage[]) {
  const seen: BaseMessage[][] = [];
  const planner: Planner = async (messages) => {
    seen.push(messages);
    return steps[Math.min(seen.length - 1, steps.length - 1)];
  };
  return { planner, seen };
}

const answerer: Answerer = async () => ({ draft: { answer: 'ok', citations: [] }, promptTokens: 1, completionTokens: 1 });
const TWO: Decomposer = async () => ({ subgoals: ['How are tokens verified?', 'Which port does the server use?'] });

const run = (planner: Planner, options: AgentOptions = {}) =>
  runAgent(
    { snapshot: snap, question: 'How are tokens verified, and which port does the server use?', type: 'Find' },
    { profile: 'agentic-v1.2', planner, answerer, decomposer: TWO, sleep: async () => {}, ...options },
  );

const cover = (map: Record<number, string[]>, extra: Record<string, unknown> = {}) =>
  call('finish', { reason: 'r', coverage: Object.entries(map).map(([s, ids]) => ({ subgoal: Number(s), evidenceIds: ids })), ...extra });

test('agentic-v1.2 is the default profile', () => {
  assert.equal(DEFAULT_AGENT_PROFILE, 'agentic-v1.2');
});

test('evidence can only cover subgoals tagged on the call that produced it', async () => {
  const { planner } = scripted([
    call('findDefinition', { symbol: 'verify', subgoals: [1] }),
    cover({ 1: ['E1'], 2: ['E1'] }),
    call('grepSearch', { pattern: 'PORT', subgoals: [2] }),
    cover({ 1: ['E1'], 2: ['E2'] }),
  ]);
  const result = await run(planner);
  const [first, second] = result.trace.finishAttempts;
  assert.equal(first.accepted, false);
  assert.deepEqual(first.missing, [2]);
  assert.match(first.problems.join(), /subgoal 2: E1 came from a call not tagged with subgoal 2/);
  assert.equal(second.accepted, true);
  assert.equal(result.trace.terminationReason, 'sufficient_evidence');
  assert.deepEqual(result.trace.steps.map((s) => s.subgoals), [[1], [2]]);
});

test('one call tagged with several subgoals can support each of them', async () => {
  const { planner } = scripted([call('grepSearch', { pattern: 'verify|PORT', regex: true, subgoals: [2, 1, 2] }), cover({ 1: ['E1'], 2: ['E1'] })]);
  const result = await run(planner, {
    tools: {
      grepSearch: async (s) => ({ tool: 'grepSearch', truncated: false, evidence: [s.evidence('src/auth.ts', 1, 1, 'grepSearch')] }),
    },
  });
  assert.deepEqual(result.trace.steps[0].subgoals, [1, 2]);
  assert.equal(result.trace.finishAttempts[0].accepted, true);
  assert.deepEqual(result.trace.subgoals!.map((s) => [s.status, s.toolCalls, s.gatheredEvidenceIds]), [
    ['covered', 1, ['E1']],
    ['covered', 1, ['E1']],
  ]);
});

test('re-tagging a duplicate call does not move its evidence to another subgoal', async () => {
  const { planner } = scripted([
    call('grepSearch', { pattern: 'PORT', subgoals: [1] }),
    call('grepSearch', { pattern: 'PORT', subgoals: [2] }),
    cover({ 1: ['E1'], 2: ['E1'] }),
  ]);
  const result = await run(planner, { limits: { maxNoProgressTurns: 2 } });
  assert.equal(result.trace.steps[1].status, 'duplicate');
  assert.equal(result.trace.finishAttempts[0].accepted, false);
  assert.match(result.trace.finishAttempts[0].problems.join(), /E1 came from a call not tagged with subgoal 2/);
});

test('unresolved needs a tool call that ran for that subgoal', async () => {
  const { planner } = scripted([
    call('findDefinition', { symbol: 'verify', subgoals: [1] }),
    cover({ 1: ['E1'] }, { unresolved: [{ subgoal: 2, reason: 'not in repo' }] }),
    call('grepSearch', { pattern: 'LISTEN_ADDR', subgoals: [2] }),
    cover({ 1: ['E1'] }, { unresolved: [{ subgoal: 2, reason: 'not in repo' }] }),
  ]);
  const result = await run(planner);
  assert.equal(result.trace.finishAttempts[0].accepted, false);
  assert.equal(result.trace.finishAttempts[1].accepted, true);
  assert.deepEqual(result.trace.subgoals!.map((s) => s.status), ['covered', 'unresolved']);
});

test('out-of-range or missing tags leave a call untagged; a single subgoal is tagged automatically', async () => {
  const a = await run(scripted([call('findDefinition', { symbol: 'verify', subgoals: [7] }), cover({ 1: ['E1'] })]).planner, {
    limits: { maxNoProgressTurns: 1 },
  });
  assert.equal(a.trace.steps[0].subgoals, undefined);
  assert.match(a.trace.finishAttempts[0].problems.join(), /E1 came from a call not tagged with subgoal 1/);

  const b = await run(scripted([call('findDefinition', { symbol: 'verify' }), cover({ 1: ['E1'] })]).planner, {
    decomposer: async ({ question }) => ({ subgoals: [question] }),
  });
  assert.deepEqual(b.trace.steps[0].subgoals, [1]);
  assert.equal(b.trace.terminationReason, 'sufficient_evidence');
});

test('findReferences searches repository-wide: include is not offered and is dropped if sent', async () => {
  const received: Record<string, unknown>[] = [];
  const findReferences: ToolImpl = async (s, args) => {
    received.push(args);
    return { tool: 'findReferences', truncated: false, evidence: [s.evidence('src/app.ts', 2, 2, 'findReferences')] };
  };
  const { planner } = scripted([
    call('findReferences', { symbol: 'verify', include: ['src/auth.ts'], subgoals: [1] }),
    cover({ 1: ['E1'] }),
  ]);
  const result = await run(planner, { tools: { findReferences }, decomposer: async ({ question }) => ({ subgoals: [question] }) });
  assert.deepEqual(received, [{ symbol: 'verify' }]);
  assert.equal('include' in result.trace.steps[0].args, false);

  const v12 = PLANNER_TOOLS_V1_2.find((t) => t.name === 'findReferences')!;
  assert.equal('include' in v12.schema.shape, false);
  assert.match(v12.description, /whole repository/);
  assert.match(v12.description, /use readFile/);
  assert.ok('include' in PLANNER_TOOLS_V1_1.find((t) => t.name === 'findReferences')!.schema.shape);
});

test('v1.2 research tools take a list of subgoal tags', () => {
  for (const t of PLANNER_TOOLS_V1_2) {
    const keys = Object.keys(t.schema.shape);
    if (t.name === 'finish') assert.deepEqual(keys, ['reason', 'coverage', 'unresolved']);
    else {
      assert.ok(keys.includes('subgoals'), t.name);
      assert.equal(keys.includes('subgoal'), false, t.name);
    }
  }
});
