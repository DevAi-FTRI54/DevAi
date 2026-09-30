import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tempDir, writeFiles } from './helpers/fixtures.js';
import { RepoSnapshot, EvidenceStore, ToolError, type ToolResult } from '../src/features/tools/index.js';
import { ToolRuntime, callKey, isTransient, ToolTimeoutError, type ToolImpl } from '../src/features/agent/tool-runtime.js';

const SHA = 'aa'.repeat(20);
const root = tempDir('devai-snap-');
writeFiles(root, { 'src/a.ts': 'export const a = 1;\nexport const b = 2;\nexport const c = 3;\n' });
const snap = new RepoSnapshot('acme', SHA, root);

const LIMITS = { maxToolCalls: 3, toolTimeoutMs: 50, maxToolRetries: 2, retryBaseDelayMs: 10, maxObservationChars: 10_000 };

function runtime(tools: Record<string, ToolImpl>, overrides: Partial<typeof LIMITS> = {}, remainingMs?: () => number) {
  const sleeps: number[] = [];
  const rt = new ToolRuntime(snap, EvidenceStore.forSnapshot(snap), {
    limits: { ...LIMITS, ...overrides },
    tools,
    remainingMs,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { rt, sleeps };
}

const lines = (start: number, end: number, tool: ToolResult['tool'] = 'readFile'): ToolImpl => async (s) => ({
  tool,
  truncated: false,
  note: `lines ${start}-${end}`,
  evidence: [s.evidence('src/a.ts', start, end, tool)],
});

test('a successful call adds evidence to the shared store and reports its IDs', async () => {
  const { rt } = runtime({ readFile: lines(1, 2) });
  const out = await rt.execute({ tool: 'readFile', args: { path: 'src/a.ts' } });
  assert.equal(out.status, 'ok');
  assert.deepEqual(out.step.evidenceIds, ['E1']);
  assert.deepEqual(out.step.newEvidenceIds, ['E1']);
  assert.equal(out.step.attempts, 1);
  assert.equal(rt.store.all()[0].content, 'export const a = 1;\nexport const b = 2;');
  assert.match(out.observation, /^readFile result: lines 1-2\nEvidence: E1\n\n\[E1\] FILE: src\/a\.ts \(lines 1-2\)/);
  assert.equal(rt.toolCalls, 1);
});

test('duplicate calls are rejected without running the tool or spending budget', async () => {
  let runs = 0;
  const { rt } = runtime({
    grepSearch: async (s) => {
      runs++;
      return { tool: 'grepSearch', truncated: false, evidence: [s.evidence('src/a.ts', 2, 2, 'grepSearch')] };
    },
  });
  await rt.execute({ tool: 'grepSearch', args: { pattern: 'b', regex: false } });
  const dup = await rt.execute({ tool: 'grepSearch', args: { regex: false, pattern: ' b ', include: undefined } });
  assert.equal(dup.status, 'duplicate');
  assert.equal(runs, 1);
  assert.equal(rt.toolCalls, 1);
  assert.deepEqual(dup.step.evidenceIds, ['E1']);
  assert.match(dup.observation, /Duplicate call rejected: grepSearch .*step 1.*evidence E1/);
});

test('callKey ignores key order, null/undefined values, and surrounding whitespace', () => {
  assert.equal(callKey('t', { a: 1, b: ' x ' }), callKey('t', { b: 'x', a: 1, c: undefined, d: null }));
  assert.notEqual(callKey('t', { a: 1 }), callKey('t', { a: 2 }));
  assert.notEqual(callKey('t', { a: 1 }), callKey('u', { a: 1 }));
});

test('the tool-call budget is a hard limit', async () => {
  let runs = 0;
  const impl: ToolImpl = async (s, a) => {
    runs++;
    return { tool: 'readFile', truncated: false, evidence: [s.evidence('src/a.ts', Number(a.startLine), Number(a.startLine), 'readFile')] };
  };
  const { rt } = runtime({ readFile: impl });
  for (const startLine of [1, 2, 3]) assert.equal((await rt.execute({ tool: 'readFile', args: { startLine } })).status, 'ok');
  assert.equal(rt.budgetExhausted, true);
  const over = await rt.execute({ tool: 'readFile', args: { startLine: 4 } });
  assert.equal(over.status, 'budget_exhausted');
  assert.equal(runs, 3);
  assert.equal(rt.toolCalls, 3);
});

test('transient failures are retried with exponential backoff, then succeed', async () => {
  let attempts = 0;
  const { rt, sleeps } = runtime({
    semanticSearch: async (s) => {
      attempts++;
      if (attempts < 3) throw new ToolError('UNAVAILABLE', 'Retrieval failed: fetch failed', 'semanticSearch');
      return { tool: 'semanticSearch', truncated: false, evidence: [s.evidence('src/a.ts', 1, 1, 'semanticSearch')] };
    },
  });
  const out = await rt.execute({ tool: 'semanticSearch', args: { query: 'q' } });
  assert.equal(out.status, 'ok');
  assert.equal(out.step.attempts, 3);
  assert.equal(out.step.errors.length, 2);
  assert.deepEqual(sleeps, [10, 20]);
  assert.equal(rt.retries, 2);
  assert.equal(rt.toolCalls, 1);
});

test('retries are bounded: a persistent transient failure stops after maxToolRetries', async () => {
  let attempts = 0;
  const { rt } = runtime({
    semanticSearch: async () => {
      attempts++;
      throw new Error('fetch failed');
    },
  });
  const out = await rt.execute({ tool: 'semanticSearch', args: { query: 'q' } });
  assert.equal(out.status, 'error');
  assert.equal(attempts, 3);
  assert.match(out.observation, /semanticSearch failed after 3 attempts: fetch failed/);
});

test('non-transient errors are not retried and are reported to the planner', async () => {
  let attempts = 0;
  const { rt } = runtime({
    readFile: async () => {
      attempts++;
      throw new ToolError('FILE_NOT_FOUND', 'File not found at aaaaaaa: nope.ts', 'readFile');
    },
  });
  const out = await rt.execute({ tool: 'readFile', args: { path: 'nope.ts' } });
  assert.equal(out.status, 'error');
  assert.equal(attempts, 1);
  assert.deepEqual(out.step.errors, ['FILE_NOT_FOUND: File not found at aaaaaaa: nope.ts']);
  assert.equal(rt.toolCalls, 1);
});

test('each attempt is bounded by the tool timeout, and timeouts are retried', async () => {
  let attempts = 0;
  const { rt } = runtime({
    semanticSearch: () => {
      attempts++;
      return new Promise(() => {});
    },
  }, { toolTimeoutMs: 20, maxToolRetries: 1 });
  const t0 = Date.now();
  const out = await rt.execute({ tool: 'semanticSearch', args: { query: 'q' } });
  assert.equal(out.status, 'timeout');
  assert.equal(attempts, 2);
  assert.deepEqual(out.step.errors, ['Tool call timed out after 20ms', 'Tool call timed out after 20ms']);
  assert.ok(Date.now() - t0 < 1000);
});

test('the remaining run budget caps attempt timeouts and blocks calls once exhausted', async () => {
  let remaining = 5;
  const { rt } = runtime({ semanticSearch: () => new Promise(() => {}) }, { toolTimeoutMs: 10_000, maxToolRetries: 0 }, () => remaining);
  const t0 = Date.now();
  const capped = await rt.execute({ tool: 'semanticSearch', args: { query: 'q' } });
  assert.equal(capped.status, 'timeout');
  assert.ok(Date.now() - t0 < 1000);
  remaining = 0;
  const blocked = await rt.execute({ tool: 'semanticSearch', args: { query: 'other' } });
  assert.equal(blocked.status, 'timeout');
  assert.equal(blocked.step.attempts, 0);
});

test('unknown tools are rejected without spending budget', async () => {
  const { rt } = runtime({});
  const out = await rt.execute({ tool: 'deleteRepo', args: {} });
  assert.equal(out.status, 'unknown_tool');
  assert.equal(rt.toolCalls, 0);
});

test('evidence already in the store is referenced by ID, not repeated, and new IDs are tracked', async () => {
  const { rt } = runtime({ readFile: lines(1, 2), grepSearch: lines(1, 2, 'grepSearch'), findDefinition: lines(3, 3, 'findDefinition') });
  await rt.execute({ tool: 'readFile', args: { path: 'src/a.ts' } });
  const again = await rt.execute({ tool: 'grepSearch', args: { pattern: 'a' } });
  assert.deepEqual(again.step.evidenceIds, ['E1']);
  assert.deepEqual(again.step.newEvidenceIds, []);
  assert.match(again.observation, /Already gathered: E1$/);
  const fresh = await rt.execute({ tool: 'findDefinition', args: { symbol: 'c' } });
  assert.deepEqual(fresh.step.newEvidenceIds, ['E2']);
});

test('long observations are truncated for the planner but stored in full', async () => {
  const { rt } = runtime({ readFile: lines(1, 3) }, { maxObservationChars: 20 });
  const out = await rt.execute({ tool: 'readFile', args: { path: 'src/a.ts' } });
  assert.match(out.observation, /more characters not shown; the evidence is stored in full\]$/);
  assert.equal(rt.store.all()[0].content.split('\n').length, 3);
});

test('isTransient classifies timeouts, UNAVAILABLE and network errors only', () => {
  assert.equal(isTransient(new ToolTimeoutError(1)), true);
  assert.equal(isTransient(new ToolError('UNAVAILABLE', 'x')), true);
  assert.equal(isTransient(new ToolError('INVALID_INPUT', 'fetch failed')), false);
  assert.equal(isTransient(new Error('ECONNRESET')), true);
  assert.equal(isTransient(new Error('Request failed with status 503')), true);
  assert.equal(isTransient(new Error('Cannot read properties of undefined')), false);
});
