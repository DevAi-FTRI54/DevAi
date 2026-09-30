import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AIMessage, ToolMessage, type BaseMessage } from '@langchain/core/messages';
import { tempDir, writeFiles } from './helpers/fixtures.js';
import { RepoSnapshot, ToolError } from '../src/features/tools/index.js';
import { runAgent, AgentError, retryAfterHintMs, type AgentOptions } from '../src/features/agent/agent.service.js';
import type { Planner } from '../src/features/agent/planner.js';
import type { Answerer, AnswerDraft } from '../src/features/agent/answerer.js';

const SHA = 'bb'.repeat(20);
const root = tempDir('devai-snap-');
writeFiles(root, {
  'src/auth.ts': [
    'export function verify(token: string) {', // 1
    '  return token.length > 0;', //              2
    '}', //                                       3
  ].join('\n') + '\n',
  'src/routes.ts': "import { verify } from './auth';\nrouter.use((req) => verify(req.token));\n",
});
const snap = new RepoSnapshot('acme', SHA, root);

let callSeq = 0;
const call = (name: string, args: Record<string, unknown>, tokens = { input_tokens: 100, output_tokens: 10 }) =>
  new AIMessage({
    content: '',
    tool_calls: [{ id: `c${++callSeq}`, name, args, type: 'tool_call' }],
    usage_metadata: { ...tokens, total_tokens: tokens.input_tokens + tokens.output_tokens },
  });
const finish = (reason = 'enough') => call('finish', { reason });

type Step = AIMessage | Error | ((messages: BaseMessage[]) => AIMessage | Promise<AIMessage>);

// Plays back planner responses in order; repeats the last one if the loop keeps asking.
function scripted(steps: Step[]) {
  const seen: BaseMessage[][] = [];
  const planner: Planner = async (messages) => {
    seen.push(messages);
    const step = steps[Math.min(seen.length - 1, steps.length - 1)];
    if (step instanceof Error) throw step;
    return typeof step === 'function' ? step(messages) : step;
  };
  return { planner, seen };
}

function answering(draft: Partial<AnswerDraft> & Record<string, unknown> = {}) {
  const prompts: Array<{ system: string; user: string }> = [];
  const answerer: Answerer = async (prompt) => {
    prompts.push(prompt);
    return { draft: { answer: 'An answer.', citations: [], ...draft } as AnswerDraft, promptTokens: 500, completionTokens: 50 };
  };
  return { answerer, prompts };
}

const run = (planner: Planner, answerer: Answerer, options: AgentOptions = {}) =>
  runAgent({ snapshot: snap, question: 'How are tokens verified?', type: 'Find' }, {
    planner,
    answerer,
    sleep: async () => {},
    ...options,
  });

test('the planner can declare sufficient evidence, which ends the loop and records the reason', async () => {
  const { planner, seen } = scripted([finish('nothing to look up')]);
  const { answerer, prompts } = answering();
  const result = await run(planner, answerer);
  assert.equal(result.trace.terminationReason, 'sufficient_evidence');
  assert.equal(result.trace.finishReason, 'nothing to look up');
  assert.equal(seen.length, 1);
  assert.equal(result.trace.toolCalls, 0);
  assert.match(prompts[0].user, /\(no evidence was gathered\)/);
});

test('each turn sees the question and all prior tool results; citations are assembled from the snapshot', async () => {
  const { planner, seen } = scripted([
    call('findDefinition', { symbol: 'verify' }),
    call('findReferences', { symbol: 'verify', contextLines: 0 }),
    finish(),
  ]);
  const { answerer, prompts } = answering({
    citations: [
      // Extra fields a model might invent are ignored; only evidence ID and lines are used.
      { evidenceId: 'E1', startLine: 2, endLine: 2, snippet: 'FAKE', file: 'evil.ts' } as never,
      { evidenceId: 'E99', startLine: 1, endLine: 1 },
    ],
  });
  const result = await run(planner, answerer);

  assert.equal(seen.length, 3);
  const third = seen[2];
  assert.match(String(third[1].content), /How are tokens verified\?/);
  const toolResults = third.filter((m): m is ToolMessage => m instanceof ToolMessage).map((m) => String(m.content));
  assert.equal(toolResults.length, 2);
  assert.match(toolResults[0], /Evidence: E1/);
  assert.match(toolResults[1], /Evidence: E2\n/);

  assert.deepEqual(result.citations, [
    { evidenceId: 'E1', file: 'src/auth.ts', startLine: 2, endLine: 2, snippet: '  return token.length > 0;' },
  ]);
  assert.equal(result.citationDiagnostics.unknownEvidence, 1);
  assert.match(prompts[0].user, /\[E1\] NAME: function verify/);
  assert.deepEqual(result.trace.answerEvidenceIds, ['E1', 'E2']);
});

test('the trace records tool sequence, arguments, evidence IDs, tokens, latency and stop reason', async () => {
  const { planner } = scripted([call('grepSearch', { pattern: 'verify', contextLines: 0 }), finish()]);
  const { answerer } = answering();
  const { trace } = await run(planner, answerer);
  assert.deepEqual(
    trace.steps.map((s) => [s.index, s.tool, s.args, s.status, s.attempts, s.evidenceIds]),
    [[1, 'grepSearch', { pattern: 'verify', contextLines: 0 }, 'ok', 1, ['E1', 'E2']]],
  );
  assert.deepEqual(trace.llmCalls.map((c) => c.phase), ['plan', 'plan', 'answer']);
  assert.deepEqual(trace.tokens, { promptTokens: 700, completionTokens: 70 });
  assert.equal(trace.terminationReason, 'sufficient_evidence');
  assert.equal(trace.commitSha, SHA);
  assert.equal(trace.repoId, 'acme');
  assert.equal(trace.evidenceCount, 2);
  assert.ok(trace.latencyMs >= 0 && trace.steps[0].latencyMs >= 0);
  assert.deepEqual(trace.errors, []);
});

test('evidence diagnostics count gathered, shown and cited evidence', async () => {
  const { planner } = scripted([
    call('readFile', { path: 'src/auth.ts' }),
    call('readFile', { path: 'src/routes.ts' }),
    call('grepSearch', { pattern: 'router', contextLines: 0 }),
    finish(),
  ]);
  const { answerer } = answering({
    citations: [
      { evidenceId: 'E1', startLine: 1, endLine: 1 },
      { evidenceId: 'E1', startLine: 2, endLine: 2 },
    ],
  });
  const { trace } = await run(planner, answerer);
  const d = trace.diagnostics!;
  assert.equal(d.evidenceItems, 3);
  assert.equal(d.uniqueFiles, 2);
  assert.equal(d.answerEvidenceItems, 3);
  assert.equal(d.citedEvidenceItems, 1);
  assert.equal(d.utilization, 1 / 3);
  assert.equal(d.answerUtilization, 1 / 3);
  assert.ok(d.evidenceTokens > 0 && d.evidenceTokens === d.answerEvidenceTokens);
});

test('the tool-call limit stops the loop without another planner call', async () => {
  let n = 0;
  const { planner, seen } = scripted([() => call('readFile', { path: 'src/auth.ts', startLine: 1, endLine: ++n })]);
  const { answerer } = answering();
  const { trace } = await run(planner, answerer, { limits: { maxToolCalls: 3, maxNoProgressTurns: 99 } });
  assert.equal(trace.terminationReason, 'max_tool_calls');
  assert.equal(trace.toolCalls, 3);
  assert.equal(seen.length, 3);
});

test('repeated identical calls are rejected and end the run as no progress', async () => {
  const { planner, seen } = scripted([call('grepSearch', { pattern: 'verify' })]);
  const { answerer } = answering();
  const { trace } = await run(planner, answerer, { limits: { maxNoProgressTurns: 3 } });
  assert.deepEqual(trace.steps.map((s) => s.status), ['ok', 'duplicate', 'duplicate', 'duplicate']);
  assert.equal(trace.toolCalls, 1);
  assert.equal(trace.terminationReason, 'no_progress');
  const lastObservation = String(seen[seen.length - 1].at(-1)!.content);
  assert.match(lastObservation, /Duplicate call rejected/);
});

test('the iteration limit bounds planner turns even when calls are rejected', async () => {
  const { planner, seen } = scripted([call('notATool', {})]);
  const { answerer } = answering();
  const { trace } = await run(planner, answerer, { limits: { maxIterations: 4, maxNoProgressTurns: 99 } });
  assert.equal(trace.terminationReason, 'max_iterations');
  assert.equal(seen.length, 4);
  assert.deepEqual(trace.steps.map((s) => s.status), Array(4).fill('unknown_tool'));
  assert.equal(trace.toolCalls, 0);
});

test('the run time budget ends the loop', async () => {
  let clock = 0;
  let n = 0;
  const { planner, seen } = scripted([
    () => {
      clock += 50;
      return call('readFile', { path: 'src/auth.ts', endLine: ++n });
    },
  ]);
  const { answerer } = answering();
  const { trace } = await run(planner, answerer, {
    now: () => clock,
    limits: { runTimeoutMs: 120, maxNoProgressTurns: 99 },
  });
  assert.equal(trace.terminationReason, 'run_timeout');
  assert.equal(seen.length, 3);
});

test('a hung planner is timed out, retried a bounded number of times, then the run answers anyway', async () => {
  const { planner, seen } = scripted([() => new Promise<AIMessage>(() => {})]);
  const { answerer } = answering();
  const { trace } = await run(planner, answerer, { limits: { plannerTimeoutMs: 20, maxLlmRetries: 1 } });
  assert.equal(trace.terminationReason, 'planner_error');
  assert.equal(seen.length, 2);
  assert.deepEqual(
    trace.llmCalls.map((c) => [c.phase, c.error ?? null]),
    [
      ['plan', 'planner timed out after 20ms'],
      ['plan', 'planner timed out after 20ms'],
      ['answer', null],
    ],
  );
  assert.equal(trace.errors.length, 1);
});

test('transient planner errors are retried with backoff; permanent ones are not', async () => {
  const flaky = scripted([new Error('fetch failed'), new Error('fetch failed'), finish()]);
  const sleeps: number[] = [];
  const ok = await run(flaky.planner, answering().answerer, {
    limits: { llmRetryBaseDelayMs: 100 },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  assert.equal(ok.trace.terminationReason, 'sufficient_evidence');
  assert.equal(flaky.seen.length, 3);
  assert.deepEqual(sleeps, [100, 200]);

  const broken = scripted([new Error('Invalid schema for function')]);
  const failed = await run(broken.planner, answering().answerer);
  assert.equal(failed.trace.terminationReason, 'planner_error');
  assert.equal(broken.seen.length, 1);
});

test('a planner reply without a tool call ends the loop as planner_no_action', async () => {
  const { planner } = scripted([new AIMessage({ content: 'I think I know.' })]);
  const { trace } = await run(planner, answering().answerer);
  assert.equal(trace.terminationReason, 'planner_no_action');
});

test('only the first of several tool calls in one reply is executed', async () => {
  const multi = new AIMessage({
    content: '',
    tool_calls: [
      { id: 'a', name: 'findDefinition', args: { symbol: 'verify' }, type: 'tool_call' },
      { id: 'b', name: 'grepSearch', args: { pattern: 'router' }, type: 'tool_call' },
    ],
  });
  const { planner, seen } = scripted([multi, finish()]);
  const { trace } = await run(planner, answering().answerer);
  assert.deepEqual(trace.steps.map((s) => s.tool), ['findDefinition']);
  const history = seen[1].filter((m) => m instanceof AIMessage) as AIMessage[];
  assert.deepEqual(history.flatMap((m) => m.tool_calls ?? []).map((c) => c.id), ['a']);
});

test('transient tool failures are retried inside the loop and counted in the trace', async () => {
  let attempts = 0;
  const { planner } = scripted([call('semanticSearch', { query: 'token verification' }), finish()]);
  const { trace } = await run(planner, answering().answerer, {
    tools: {
      semanticSearch: async (s) => {
        if (++attempts === 1) throw new ToolError('UNAVAILABLE', 'Retrieval failed: fetch failed', 'semanticSearch');
        return { tool: 'semanticSearch', truncated: false, evidence: [s.evidence('src/auth.ts', 1, 3, 'semanticSearch')] };
      },
    },
  });
  assert.equal(trace.steps[0].status, 'ok');
  assert.equal(trace.steps[0].attempts, 2);
  assert.deepEqual(trace.steps[0].errors, ['UNAVAILABLE: Retrieval failed: fetch failed']);
  assert.equal(trace.retries, 1);
});

test('the answer only sees evidence within its token budget and cannot cite anything else', async () => {
  const { planner } = scripted([
    call('readFile', { path: 'src/auth.ts' }),
    call('readFile', { path: 'src/routes.ts' }),
    finish(),
  ]);
  const { answerer, prompts } = answering({ citations: [{ evidenceId: 'E2', startLine: 1, endLine: 1 }] });
  const result = await run(planner, answerer, { limits: { maxAnswerEvidenceTokens: 40 } });
  assert.deepEqual(result.trace.answerEvidenceIds, ['E1']);
  assert.doesNotMatch(prompts[0].user, /\[E2\]/);
  assert.deepEqual(result.citations, []);
  assert.equal(result.citationDiagnostics.unknownEvidence, 1);
  assert.equal(result.allEvidence.length, 2);
});

test('a rate-limited answer is retried, waiting at least as long as the provider asks', async () => {
  const { planner } = scripted([call('findDefinition', { symbol: 'verify' }), finish()]);
  let attempts = 0;
  const answerer: Answerer = async () => {
    if (++attempts === 1) throw new Error('429 Rate limit reached for gpt-4o-mini. Please try again in 1.314s.');
    return { draft: { answer: 'ok', citations: [{ evidenceId: 'E1', startLine: 2, endLine: 2 }] }, promptTokens: 10, completionTokens: 1 };
  };
  const sleeps: number[] = [];
  const result = await run(planner, answerer, {
    limits: { llmRetryBaseDelayMs: 100 },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  assert.equal(result.answer, 'ok');
  assert.equal(result.citations[0].snippet, '  return token.length > 0;');
  assert.deepEqual(sleeps, [1314]);
  assert.deepEqual(result.trace.llmCalls.filter((c) => c.phase === 'answer').map((c) => !!c.error), [true, false]);
  assert.deepEqual(result.trace.errors, []);
});

test('answer retries are bounded, and a permanent failure raises AgentError carrying the trace', async () => {
  const { planner } = scripted([call('findDefinition', { symbol: 'verify' }), finish()]);
  let attempts = 0;
  const persistent: Answerer = async () => {
    attempts++;
    throw new Error('503 Service Unavailable');
  };
  await assert.rejects(run(planner, persistent, { limits: { maxLlmRetries: 2 } }), AgentError);
  assert.equal(attempts, 3);

  const { planner: planner2 } = scripted([call('findDefinition', { symbol: 'verify' }), finish()]);
  let permanentAttempts = 0;
  const permanent: Answerer = async () => {
    permanentAttempts++;
    throw new Error('model unavailable');
  };
  await assert.rejects(run(planner2, permanent), (err: unknown) => {
    assert.ok(err instanceof AgentError);
    assert.equal(err.trace.terminationReason, 'sufficient_evidence');
    assert.equal(err.trace.steps.length, 1);
    assert.deepEqual(err.trace.errors, ['answer: model unavailable']);
    return true;
  });
  assert.equal(permanentAttempts, 1);
});

test('retryAfterHintMs reads provider wait hints and caps them', () => {
  assert.equal(retryAfterHintMs(new Error('Please try again in 1.314s.')), 1314);
  assert.equal(retryAfterHintMs(new Error('Please try again in 254ms.')), 254);
  assert.equal(retryAfterHintMs(new Error('Please try again in 90s.')), 10_000);
  assert.equal(retryAfterHintMs(new Error('fetch failed')), 0);
});

test('null optional arguments from the model are dropped before the tool runs', async () => {
  const { planner } = scripted([
    call('grepSearch', { pattern: 'verify', include: null, regex: null, contextLines: 0 }),
    finish(),
  ]);
  const { trace } = await run(planner, answering().answerer);
  assert.equal(trace.steps[0].status, 'ok');
  assert.deepEqual(trace.steps[0].args, { pattern: 'verify', contextLines: 0 });
});
