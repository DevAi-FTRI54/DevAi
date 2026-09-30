import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AIMessage } from '@langchain/core/messages';
import { tempDir, writeFiles } from './helpers/fixtures.js';
import { RepoSnapshot, EvidenceStore } from '../src/features/tools/index.js';
import { ToolRuntime } from '../src/features/agent/tool-runtime.js';
import { symbolGuard, snapshotIdentifiers } from '../src/features/agent/symbol-guard.js';
import { runAgent } from '../src/features/agent/agent.service.js';
import type { Planner } from '../src/features/agent/planner.js';
import type { Answerer } from '../src/features/agent/answerer.js';
import { PLANNER_TOOLS_V1_1 } from '../src/features/agent/planner-v1_1.js';
import { DEFAULT_AGENT_LIMITS } from '../src/features/agent/types.js';

const SHA = 'cc'.repeat(20);
const root = tempDir('devai-snap-');
writeFiles(root, {
  'src/session.ts': 'export class Session {\n  refresh(token: string) {\n    return token;\n  }\n}\n',
  'src/app.ts': "import { Session } from './session';\nnew Session().refresh('x');\n",
});
const snap = new RepoSnapshot('acme', SHA, root);
const guard = symbolGuard(snap);

test('the identifier set covers every identifier-shaped token in the snapshot', () => {
  const ids = snapshotIdentifiers(snap);
  for (const name of ['Session', 'refresh', 'token', 'import']) assert.ok(ids.has(name), name);
  assert.equal(ids.has('logoutUser'), false);
  assert.equal(snapshotIdentifiers(snap), ids);
});

test('findReferences accepts one exact identifier that occurs in the repository', () => {
  assert.equal(guard('findReferences', { symbol: 'Session' }), null);
  assert.equal(guard('findReferences', { symbol: ' refresh ' }), null);
});

test('findReferences rejects prose, phrases, and dotted or call-shaped input', () => {
  for (const symbol of ['session refresh logic', 'where tokens are refreshed', 'Session.refresh', 'refresh()', '', 'a-b']) {
    const msg = guard('findReferences', { symbol });
    assert.ok(msg, symbol);
    assert.match(msg!, /exact identifier/);
    assert.match(msg!, /semanticSearch/);
  }
});

test('names that never occur in the snapshot are rejected as guesses', () => {
  assert.match(guard('findReferences', { symbol: 'logoutUser' })!, /"logoutUser" does not occur anywhere/);
  assert.match(guard('findDefinition', { symbol: 'Session.revoke' })!, /"revoke" does not occur/);
});

test('findDefinition also accepts Class.member; other tools are never guarded', () => {
  assert.equal(guard('findDefinition', { symbol: 'Session.refresh' }), null);
  assert.ok(guard('findDefinition', { symbol: 'a.b.c' }));
  assert.equal(guard('grepSearch', { pattern: 'anything at all' }), null);
  assert.equal(guard('semanticSearch', { query: 'how sessions refresh' }), null);
});

test('a refused call spends no budget, runs nothing, and can be retried with a valid symbol', async () => {
  let runs = 0;
  const rt = new ToolRuntime(snap, EvidenceStore.forSnapshot(snap), {
    limits: { ...DEFAULT_AGENT_LIMITS, maxToolCalls: 1 },
    guard,
    tools: {
      findReferences: async (s) => {
        runs++;
        return { tool: 'findReferences', truncated: false, evidence: [s.evidence('src/app.ts', 2, 2, 'findReferences')] };
      },
    },
  });
  const refused = await rt.execute({ tool: 'findReferences', args: { symbol: 'session refresh' } });
  assert.equal(refused.status, 'rejected_input');
  assert.match(refused.observation, /refused \(no budget used\)/);
  assert.equal(rt.toolCalls, 0);
  assert.equal(runs, 0);
  assert.equal((await rt.execute({ tool: 'findReferences', args: { symbol: 'session refresh' } })).status, 'rejected_input');
  assert.equal((await rt.execute({ tool: 'findReferences', args: { symbol: 'Session' } })).status, 'ok');
  assert.equal(runs, 1);
});

let seq = 0;
const call = (name: string, args: Record<string, unknown>) =>
  new AIMessage({ content: '', tool_calls: [{ id: `g${++seq}`, name, args, type: 'tool_call' }] });
const answerer: Answerer = async () => ({ draft: { answer: 'ok', citations: [] }, promptTokens: 1, completionTokens: 1 });

async function runProfile(profile: 'agentic-v1' | 'agentic-v1.1') {
  const script = [call('findReferences', { symbol: 'logoutUser' }), call('finish', { reason: 'done' })];
  let turn = 0;
  const planner: Planner = async () => script[Math.min(turn++, script.length - 1)];
  return runAgent(
    { snapshot: snap, question: 'Who logs users out?', type: 'Find' },
    { profile, planner, answerer, sleep: async () => {} },
  );
}

test('the guard is part of the agentic-v1.1 profile only; agentic-v1 behaves as before', async () => {
  const v11 = await runProfile('agentic-v1.1');
  assert.equal(v11.trace.profile, 'agentic-v1.1');
  assert.equal(v11.trace.steps[0].status, 'rejected_input');
  assert.equal(v11.trace.toolCalls, 0);

  const v1 = await runProfile('agentic-v1');
  assert.equal(v1.trace.profile, 'agentic-v1');
  assert.equal(v1.trace.steps[0].status, 'ok');
  assert.equal(v1.trace.toolCalls, 1);
});

test('v1.1 tool descriptions give each tool a distinct role and scope findReferences to known symbols', () => {
  const byName = Object.fromEntries(PLANNER_TOOLS_V1_1.map((t) => [t.name, t.description]));
  assert.deepEqual(Object.keys(byName).sort(), ['findDefinition', 'findReferences', 'finish', 'grepSearch', 'readFile', 'semanticSearch']);
  assert.match(byName.findReferences, /known exact/i);
  assert.match(byName.findReferences, /not a search tool/i);
  assert.match(byName.semanticSearch, /discover/i);
});
