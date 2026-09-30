// Agentic loop: a bounded LangGraph loop (plan -> act -> plan ... -> answer) over one pinned snapshot.
// The planner picks one tool per turn or declares sufficient evidence; hard limits end the loop otherwise.
// Profiles keep earlier versions reproducible: agentic-v1 is the original planner; agentic-v1.1 adds
// role-specific tool descriptions and the symbol guard.
import { randomUUID } from 'crypto';
import { Annotation, StateGraph } from '@langchain/langgraph';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage, type BaseMessage } from '@langchain/core/messages';
import type { Callbacks } from '@langchain/core/callbacks/manager';
import { EvidenceStore, RepoSnapshot, ToolError, type ToolName } from '../tools/index.js';
import type { Citation, CitationDiagnostics, Evidence } from '../queries/evidence.js';
import { generateUniqueRepoId } from '../indexing/git.service.js';
import { ToolRuntime, isTransient, type ToolImpl } from './tool-runtime.js';
import { FINISH_TOOL, PLANNER_TOOLS, createDefaultPlanner, plannerSystemPrompt, type Planner } from './planner.js';
import { PLANNER_TOOLS_V1_1, plannerSystemPromptV1_1 } from './planner-v1_1.js';
import { symbolGuard } from './symbol-guard.js';
import { createDefaultDecomposer, normalizeSubgoals, type Decomposer } from './decomposer.js';
import { checkFinish, rejectionMessage, subgoalStatus, subgoalsPromptSection } from './coverage.js';
import { answerSystemPrompt, answerUserPrompt, createDefaultAnswerer, type Answerer } from './answerer.js';
import {
  DEFAULT_AGENT_LIMITS,
  type AgentLimits,
  type AgentProfile,
  type AgentTrace,
  type EvidenceDiagnostics,
  type LlmCallTrace,
  type TerminationReason,
} from './types.js';

export type AgentRunResult = {
  answer: string;
  citations: Citation[];
  citationDiagnostics: CitationDiagnostics;
  // Evidence given to the answer step, and everything the tools gathered.
  evidence: Evidence[];
  allEvidence: Evidence[];
  trace: AgentTrace;
};

const PROFILES = {
  'agentic-v1': { tools: PLANNER_TOOLS, systemPrompt: plannerSystemPrompt, guardSymbols: false, subgoals: false },
  'agentic-v1.1': { tools: PLANNER_TOOLS_V1_1, systemPrompt: plannerSystemPromptV1_1, guardSymbols: true, subgoals: true },
} as const;

export const DEFAULT_AGENT_PROFILE: AgentProfile = 'agentic-v1.1';

export type AgentOptions = {
  profile?: AgentProfile;
  limits?: Partial<AgentLimits>;
  planner?: Planner;
  answerer?: Answerer;
  decomposer?: Decomposer;
  tools?: Partial<Record<ToolName, ToolImpl>>;
  callbacks?: Callbacks;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export class AgentError extends Error {
  constructor(
    message: string,
    readonly trace: AgentTrace,
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

class LlmTimeoutError extends Error {
  constructor(phase: string, ms: number) {
    super(`${phase} timed out after ${ms}ms`);
    this.name = 'LlmTimeoutError';
  }
}

// Aborts the request and stops waiting once the time limit passes.
async function timed<T>(phase: string, ms: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new LlmTimeoutError(phase, ms));
    }, ms);
  });
  try {
    return await Promise.race([work(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

const roughTokens = (s: string) => Math.ceil(s.length / 4);
const errorText = (err: unknown) => String((err as Error)?.message ?? err);

export function evidenceDiagnostics(
  all: Evidence[],
  shown: Evidence[],
  citations: Citation[],
  tokens: (e: Evidence) => number,
): EvidenceDiagnostics {
  const cited = new Set(citations.map((c) => c.evidenceId)).size;
  const sum = (xs: Evidence[]) => xs.reduce((s, e) => s + tokens(e), 0);
  return {
    evidenceItems: all.length,
    uniqueFiles: new Set(all.map((e) => e.filePath)).size,
    evidenceTokens: sum(all),
    answerEvidenceItems: shown.length,
    answerEvidenceTokens: sum(shown),
    citedEvidenceItems: cited,
    utilization: all.length ? cited / all.length : null,
    answerUtilization: shown.length ? cited / shown.length : null,
  };
}

const MAX_HINTED_DELAY_MS = 10_000;

// Rate-limit errors say how long to wait ("Please try again in 1.314s" / "254ms").
export function retryAfterHintMs(err: unknown): number {
  const m = /try again in ([\d.]+)\s*(ms|s)\b/i.exec(errorText(err));
  if (!m) return 0;
  const ms = Number(m[1]) * (m[2].toLowerCase() === 's' ? 1000 : 1);
  return Number.isFinite(ms) ? Math.min(Math.ceil(ms), MAX_HINTED_DELAY_MS) : 0;
}

export async function runAgent(
  input: { snapshot: RepoSnapshot; question: string; type?: string },
  options: AgentOptions = {},
): Promise<AgentRunResult> {
  const { snapshot, question, type } = input;
  const limits: AgentLimits = { ...DEFAULT_AGENT_LIMITS, ...options.limits };
  const now = options.now ?? (() => performance.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const profileName = options.profile ?? DEFAULT_AGENT_PROFILE;
  const profile = PROFILES[profileName];
  const planner = options.planner ?? createDefaultPlanner([...profile.tools]);
  const answerer = options.answerer ?? createDefaultAnswerer();
  const started = now();
  const remainingMs = () => limits.runTimeoutMs - (now() - started);

  const store = EvidenceStore.forSnapshot(snapshot);
  const runtime = new ToolRuntime(snapshot, store, {
    limits,
    tools: options.tools,
    remainingMs,
    sleep: options.sleep,
    now,
    guard: profile.guardSymbols ? symbolGuard(snapshot) : undefined,
  });
  const trace: AgentTrace = {
    runId: randomUUID(),
    profile: profileName,
    subgoals: null,
    finishAttempts: [],
    question,
    repoId: snapshot.repoId,
    commitSha: snapshot.commitSha,
    limits,
    startedAt: new Date().toISOString(),
    latencyMs: 0,
    terminationReason: null,
    steps: runtime.steps,
    llmCalls: [],
    tokens: { promptTokens: 0, completionTokens: 0 },
    toolCalls: 0,
    retries: 0,
    evidenceCount: 0,
    answerEvidenceIds: [],
    citationDiagnostics: null,
    diagnostics: null,
    errors: [],
  };
  const recordLlm = (call: LlmCallTrace) => {
    trace.llmCalls.push(call);
    trace.tokens.promptTokens += call.promptTokens;
    trace.tokens.completionTokens += call.completionTokens;
  };
  const finalizeTrace = () => {
    trace.latencyMs = now() - started;
    trace.toolCalls = runtime.toolCalls;
    trace.retries = runtime.retries;
    trace.evidenceCount = store.all().length;
    if (trace.subgoals && !trace.finishAttempts.at(-1)?.accepted) {
      trace.subgoals = subgoalStatus(
        trace.subgoals.map((s) => s.text),
        runtime.steps,
      );
    }
  };

  const State = Annotation.Root({
    messages: Annotation<BaseMessage[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
    pending: Annotation<{ id: string; tool: string; args: Record<string, unknown> } | null>,
    termination: Annotation<TerminationReason | null>,
    subgoals: Annotation<string[]>,
    iterations: Annotation<number>,
    noProgress: Annotation<number>,
    result: Annotation<Omit<AgentRunResult, 'trace' | 'allEvidence'> | null>,
  });
  type S = typeof State.State;

  // Bounded retries with exponential backoff (or the provider's hint, if longer) for transient model failures.
  const callLlm = async <T,>(
    phase: LlmCallTrace['phase'],
    timeoutMs: () => number,
    work: (signal: AbortSignal) => Promise<T>,
    usage: (value: T) => { promptTokens: number; completionTokens: number },
  ): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      const t0 = now();
      try {
        const label = phase === 'plan' ? 'planner' : phase === 'decompose' ? 'decomposer' : 'answer';
        const value = await timed(label, Math.max(1, timeoutMs()), work);
        recordLlm({ phase, latencyMs: now() - t0, ...usage(value) });
        return value;
      } catch (err) {
        recordLlm({ phase, latencyMs: now() - t0, promptTokens: 0, completionTokens: 0, error: errorText(err) });
        const retryable = err instanceof LlmTimeoutError || isTransient(err);
        if (!retryable || attempt >= limits.maxLlmRetries || timeoutMs() <= 0) throw err;
        await sleep(Math.max(limits.llmRetryBaseDelayMs * 2 ** attempt, retryAfterHintMs(err)));
      }
    }
  };

  const callPlanner = (messages: BaseMessage[]): Promise<AIMessage> =>
    callLlm(
      'plan',
      () => Math.min(limits.plannerTimeoutMs, remainingMs()),
      (signal) => planner(messages, { signal, callbacks: options.callbacks }),
      (msg) => ({
        promptTokens: msg.usage_metadata?.input_tokens ?? 0,
        completionTokens: msg.usage_metadata?.output_tokens ?? 0,
      }),
    );

  const plan = async (state: S): Promise<Partial<S>> => {
    const stop = (termination: TerminationReason): Partial<S> => ({ termination, pending: null });
    if (remainingMs() <= 0) return stop('run_timeout');
    if (state.iterations >= limits.maxIterations) return stop('max_iterations');
    if (runtime.budgetExhausted) return stop('max_tool_calls');
    if (state.noProgress >= limits.maxNoProgressTurns) return stop('no_progress');

    const system = profile.systemPrompt(
      snapshot,
      {
        toolCallsUsed: runtime.toolCalls,
        maxToolCalls: limits.maxToolCalls,
        turnsLeft: limits.maxIterations - state.iterations,
      },
      profile.subgoals ? subgoalsPromptSection(state.subgoals, runtime.steps) : '',
    );
    let msg: AIMessage;
    try {
      msg = await callPlanner([new SystemMessage(system), ...state.messages]);
    } catch (err) {
      trace.errors.push(`planner: ${errorText(err)}`);
      return stop(remainingMs() <= 0 ? 'run_timeout' : 'planner_error');
    }
    const call = msg.tool_calls?.[0];
    if (!call) return stop('planner_no_action');
    const id = call.id ?? `call_${state.iterations + 1}`;
    if (call.name === FINISH_TOOL) {
      if (profile.subgoals) {
        const check = checkFinish(call.args, state.subgoals, runtime.steps, new Set(store.all().map((e) => e.id)));
        trace.finishAttempts.push({ accepted: check.accepted, missing: check.missing, problems: check.problems });
        trace.subgoals = check.subgoals;
        if (!check.accepted) {
          // A rejected finish costs a turn and counts toward the no-progress limit, so it cannot loop forever.
          return {
            messages: [
              new AIMessage({ content: '', tool_calls: [{ id, name: call.name, args: call.args ?? {}, type: 'tool_call' }] }),
              new ToolMessage({ content: rejectionMessage(check), tool_call_id: id, name: call.name }),
            ],
            pending: null,
            iterations: state.iterations + 1,
            noProgress: state.noProgress + 1,
          };
        }
      }
      trace.finishReason = typeof call.args?.reason === 'string' ? call.args.reason : undefined;
      return stop('sufficient_evidence');
    }
    // Only one call per turn is executed; history keeps exactly that call so tool messages pair up.
    const turn = new AIMessage({
      content: typeof msg.content === 'string' ? msg.content : '',
      tool_calls: [{ id, name: call.name, args: call.args ?? {}, type: 'tool_call' }],
    });
    return {
      messages: [turn],
      pending: { id, tool: call.name, args: call.args ?? {} },
      iterations: state.iterations + 1,
    };
  };

  const act = async (state: S): Promise<Partial<S>> => {
    const pending = state.pending!;
    const { subgoal, ...args } = pending.args;
    const outcome = await runtime.execute({ tool: pending.tool, args: profile.subgoals ? args : pending.args });
    if (profile.subgoals) {
      const n = state.subgoals.length === 1 ? 1 : Number(subgoal);
      if (Number.isInteger(n) && n >= 1 && n <= state.subgoals.length) outcome.step.subgoal = n;
    }
    const progressed = outcome.step.newEvidenceIds.length > 0;
    return {
      messages: [new ToolMessage({ content: outcome.observation, tool_call_id: pending.id, name: pending.tool })],
      pending: null,
      noProgress: progressed ? 0 : state.noProgress + 1,
    };
  };

  const answer = async (state: S): Promise<Partial<S>> => {
    trace.terminationReason = state.termination;
    const shown: Evidence[] = [];
    let used = 0;
    for (const ev of store.all()) {
      const cost = roughTokens(store.format([ev]));
      if (used + cost > limits.maxAnswerEvidenceTokens) continue;
      shown.push(ev);
      used += cost;
    }
    trace.answerEvidenceIds = shown.map((e) => e.id);

    const answerDeadline = now() + limits.answerTimeoutMs;
    try {
      const { draft } = await callLlm(
        'answer',
        () => answerDeadline - now(),
        (signal) =>
          answerer(
            { system: answerSystemPrompt(type), user: answerUserPrompt(question, store.format(shown)) },
            { signal, callbacks: options.callbacks },
          ),
        ({ promptTokens, completionTokens }) => ({ promptTokens, completionTokens }),
      );
      const refs = (Array.isArray(draft?.citations) ? draft.citations : []).map((c) => ({
        evidenceId: String(c?.evidenceId ?? ''),
        startLine: Number(c?.startLine),
        endLine: Number(c?.endLine),
      }));
      const { citations, diagnostics } = store.cite(refs, shown);
      trace.citationDiagnostics = diagnostics;
      trace.diagnostics = evidenceDiagnostics(store.all(), shown, citations, (e) => roughTokens(store.format([e])));
      return {
        result: { answer: String(draft?.answer ?? ''), citations, citationDiagnostics: diagnostics, evidence: shown },
      };
    } catch (err) {
      trace.errors.push(`answer: ${errorText(err)}`);
      throw err;
    }
  };

  // Failure here is not fatal: the question itself becomes the only subgoal.
  const decompose = async (): Promise<Partial<S>> => {
    const decomposer = options.decomposer ?? createDefaultDecomposer();
    let subgoals = [question];
    try {
      const out = await callLlm(
        'decompose',
        () => Math.min(limits.plannerTimeoutMs, remainingMs()),
        (signal) => decomposer({ question, type }, { signal, callbacks: options.callbacks }),
        (v) => ({ promptTokens: v.promptTokens ?? 0, completionTokens: v.completionTokens ?? 0 }),
      );
      subgoals = normalizeSubgoals(out.subgoals, question);
    } catch (err) {
      trace.errors.push(`decompose: ${errorText(err)}`);
    }
    trace.subgoals = subgoalStatus(subgoals, runtime.steps);
    return { subgoals };
  };

  const graph = new StateGraph(State)
    .addNode('decompose', decompose)
    .addNode('plan', plan)
    .addNode('act', act)
    .addNode('answer', answer)
    .addConditionalEdges('__start__', () => (profile.subgoals ? 'decompose' : 'plan'), ['decompose', 'plan'])
    .addEdge('decompose', 'plan')
    .addConditionalEdges('plan', (s: S) => (s.termination ? 'answer' : s.pending ? 'act' : 'plan'), ['act', 'answer', 'plan'])
    .addEdge('act', 'plan')
    .addEdge('answer', '__end__')
    .compile();

  const firstTurn = `Question${type ? ` (${type})` : ''}: ${question}`;
  try {
    const final = await graph.invoke(
      {
        messages: [new HumanMessage(firstTurn)],
        pending: null,
        termination: null,
        subgoals: [question],
        iterations: 0,
        noProgress: 0,
        result: null,
      },
      { recursionLimit: 2 * limits.maxIterations + 6, runName: profileName, callbacks: options.callbacks },
    );
    finalizeTrace();
    return { ...final.result!, allEvidence: store.all(), trace };
  } catch (err) {
    finalizeTrace();
    if (!trace.errors.length) trace.errors.push(errorText(err));
    throw new AgentError(errorText(err), trace);
  }
}

const snapshots = new Map<string, RepoSnapshot>();

// The snapshot the repo's index was built from: exactly one indexed commit, checked out by SHA.
export async function resolveIndexedSnapshot(repoUrl: string): Promise<RepoSnapshot> {
  const repoId = generateUniqueRepoId(repoUrl);
  const { getIndexedCommitShas } = await import('../indexing/vector.service.js');
  const shas = await getIndexedCommitShas(repoId);
  if (shas.length !== 1) {
    throw new ToolError(
      'SNAPSHOT_NOT_FOUND',
      shas.length
        ? `Index for ${repoId} spans ${shas.length} commits (${shas.map((s) => s.slice(0, 7)).join(', ')}); re-index it.`
        : `Index for ${repoId} has no recorded commit; re-index it.`,
    );
  }
  const key = `${repoId}@${shas[0]}`;
  const cached = snapshots.get(key);
  if (cached) return cached;
  let snapshot: RepoSnapshot;
  try {
    snapshot = RepoSnapshot.open(repoId, shas[0]);
  } catch (err) {
    if (!(err instanceof ToolError && err.code === 'SNAPSHOT_NOT_FOUND')) throw err;
    snapshot = await RepoSnapshot.checkout(repoUrl, shas[0]);
  }
  snapshots.set(key, snapshot);
  return snapshot;
}

export async function answerWithAgent(
  repoUrl: string,
  question: string,
  type: string,
  options: AgentOptions = {},
): Promise<AgentRunResult> {
  const snapshot = await resolveIndexedSnapshot(repoUrl);
  return runAgent({ snapshot, question, type }, options);
}
