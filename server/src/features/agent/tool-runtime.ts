// Executes planner-requested tool calls against one pinned snapshot under hard limits:
// a call budget, duplicate rejection, per-attempt timeouts, and bounded retries for transient failures.
import {
  EvidenceStore,
  RepoSnapshot,
  ToolError,
  findDefinition,
  findReferences,
  grepSearch,
  readFile,
  semanticSearch,
  type ToolName,
  type ToolResult,
} from '../tools/index.js';
import type { Evidence } from '../queries/evidence.js';
import {
  isToolName,
  type AgentLimits,
  type ToolCallRequest,
  type ToolOutcome,
  type ToolStepTrace,
} from './types.js';

export type ToolImpl = (snapshot: RepoSnapshot, args: Record<string, unknown>) => Promise<ToolResult>;

export const DEFAULT_TOOLS: Record<ToolName, ToolImpl> = {
  semanticSearch: (s, a) => semanticSearch(s, a as never),
  grepSearch: (s, a) => grepSearch(s, a as never),
  readFile: (s, a) => readFile(s, a as never),
  findDefinition: (s, a) => findDefinition(s, a as never),
  findReferences: (s, a) => findReferences(s, a as never),
};

export class ToolTimeoutError extends Error {
  constructor(ms: number) {
    super(`Tool call timed out after ${ms}ms`);
    this.name = 'ToolTimeoutError';
  }
}

const TRANSIENT_MESSAGE = /fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|rate limit|\b(429|502|503|504)\b/i;

export function isTransient(err: unknown): boolean {
  if (err instanceof ToolTimeoutError) return true;
  if (err instanceof ToolError) return err.code === 'UNAVAILABLE';
  return TRANSIENT_MESSAGE.test(String((err as Error)?.message ?? err));
}

// Stable key for duplicate detection: key order and undefined/null values do not matter.
export function callKey(tool: string, args: Record<string, unknown>): string {
  const canonical = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v as object)
          .filter((k) => (v as Record<string, unknown>)[k] !== undefined && (v as Record<string, unknown>)[k] !== null)
          .sort()
          .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
      );
    }
    return typeof v === 'string' ? v.trim() : v;
  };
  return `${tool}:${JSON.stringify(canonical(args ?? {}))}`;
}

export type ToolRuntimeOptions = {
  limits: Pick<AgentLimits, 'maxToolCalls' | 'toolTimeoutMs' | 'maxToolRetries' | 'retryBaseDelayMs' | 'maxObservationChars'>;
  tools?: Partial<Record<ToolName, ToolImpl>>;
  // Remaining run budget in ms; each attempt's timeout is capped by it.
  remainingMs?: () => number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Races the call against a timer. Synchronous work inside a tool (e.g. parsing) cannot be preempted;
// the timeout bounds waiting on asynchronous work such as retrieval.
function withTimeout<T>(work: () => Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ToolTimeoutError(ms)), ms);
  });
  return Promise.race([Promise.resolve().then(work), timeout]).finally(() => clearTimeout(timer));
}

export class ToolRuntime {
  readonly steps: ToolStepTrace[] = [];
  private seen = new Map<string, ToolStepTrace>();
  private executed = 0;
  private retryCount = 0;
  private tools: Record<ToolName, ToolImpl>;
  private sleep: (ms: number) => Promise<void>;
  private now: () => number;

  constructor(
    readonly snapshot: RepoSnapshot,
    readonly store: EvidenceStore,
    private options: ToolRuntimeOptions,
  ) {
    this.tools = { ...DEFAULT_TOOLS, ...options.tools };
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? (() => performance.now());
  }

  get toolCalls(): number {
    return this.executed;
  }

  get retries(): number {
    return this.retryCount;
  }

  get budgetExhausted(): boolean {
    return this.executed >= this.options.limits.maxToolCalls;
  }

  async execute(request: ToolCallRequest): Promise<ToolOutcome> {
    const { tool } = request;
    // Models often send null for omitted optional arguments.
    const args = Object.fromEntries(
      Object.entries(request.args && typeof request.args === 'object' ? request.args : {}).filter(
        ([, v]) => v !== null && v !== undefined,
      ),
    );
    const started = this.now();
    const step: ToolStepTrace = {
      index: this.steps.length + 1,
      tool,
      args,
      status: 'ok',
      attempts: 0,
      errors: [],
      evidenceIds: [],
      newEvidenceIds: [],
      truncated: false,
      latencyMs: 0,
    };
    this.steps.push(step);
    const finish = (status: ToolStepTrace['status'], observation: string): ToolOutcome => {
      step.status = status;
      step.latencyMs = this.now() - started;
      return { status, step, observation };
    };

    if (!isToolName(tool)) {
      return finish('unknown_tool', `Unknown tool "${tool}". Available: ${Object.keys(this.tools).join(', ')}.`);
    }
    const key = callKey(tool, args);
    const previous = this.seen.get(key);
    if (previous) {
      step.evidenceIds = [...previous.evidenceIds];
      return finish(
        'duplicate',
        `Duplicate call rejected: ${tool} was already called with these arguments (step ${previous.index}, ` +
          `status ${previous.status}${previous.evidenceIds.length ? `, evidence ${previous.evidenceIds.join(', ')}` : ''}). ` +
          'Use different arguments, another tool, or finish.',
      );
    }
    if (this.budgetExhausted) {
      return finish('budget_exhausted', `Tool budget exhausted (${this.options.limits.maxToolCalls} calls). Finish now.`);
    }

    this.seen.set(key, step);
    this.executed++;
    const { maxToolRetries, retryBaseDelayMs, toolTimeoutMs } = this.options.limits;
    for (let attempt = 0; attempt <= maxToolRetries; attempt++) {
      if (attempt > 0) {
        this.retryCount++;
        await this.sleep(retryBaseDelayMs * 2 ** (attempt - 1));
      }
      const remaining = this.options.remainingMs?.() ?? Infinity;
      if (remaining <= 0) {
        step.errors.push('Run time budget exhausted before the call could run');
        return finish('timeout', `${tool} was not run: the run time budget is exhausted.`);
      }
      step.attempts++;
      try {
        const result = await withTimeout(
          () => this.tools[tool](this.snapshot, args),
          Math.max(1, Math.min(toolTimeoutMs, remaining)),
        );
        return finish('ok', this.record(step, result));
      } catch (err) {
        step.errors.push(err instanceof ToolError ? `${err.code}: ${err.message}` : String((err as Error)?.message ?? err));
        if (!isTransient(err) || attempt === maxToolRetries) {
          const status = err instanceof ToolTimeoutError ? 'timeout' : 'error';
          return finish(status, `${tool} failed${step.attempts > 1 ? ` after ${step.attempts} attempts` : ''}: ${step.errors[step.errors.length - 1]}`);
        }
      }
    }
    return finish('error', `${tool} failed`);
  }

  private record(step: ToolStepTrace, result: ToolResult): string {
    const before = this.store.all().length;
    const items = this.store.addResult(result);
    const fresh = new Set(this.store.all().slice(before).map((e) => e.id));
    step.evidenceIds = items.map((e) => e.id);
    step.newEvidenceIds = step.evidenceIds.filter((id) => fresh.has(id));
    step.truncated = result.truncated;
    step.note = result.note;
    return this.observation(step, items, fresh);
  }

  // Evidence already shown earlier is referenced by ID instead of repeated.
  private observation(step: ToolStepTrace, items: Evidence[], fresh: Set<string>): string {
    const header = [
      `${step.tool} result: ${step.note ?? ''}${step.truncated ? ' (truncated)' : ''}`.trim(),
      items.length ? `Evidence: ${step.evidenceIds.join(', ')}` : 'No evidence returned.',
    ];
    const repeated = items.filter((e) => !fresh.has(e.id)).map((e) => e.id);
    if (repeated.length) header.push(`Already gathered: ${repeated.join(', ')}`);
    const body = this.store.format(items.filter((e) => fresh.has(e.id)));
    const max = this.options.limits.maxObservationChars;
    const shown = body.length > max ? `${body.slice(0, max)}\n… [${body.length - max} more characters not shown; the evidence is stored in full]` : body;
    return `${header.join('\n')}${shown ? `\n\n${shown}` : ''}`;
  }
}
