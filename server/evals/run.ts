// Runs the golden set through one system and records retrieval, citation, judge, latency, and cost metrics.
// Usage: npm run eval:run -- --system rag-v2.1|rag-v2.2|agentic-v1|agentic-v1.1|agentic-v1.2 [--only E01,X03] [--category cross_file]
//        [--repeats 1] [--concurrency 1] [--no-judge] [--verbose] [--save-baseline rag-v1] [--golden path] [--allow-no-rerank]
//        [--no-rerank-cache]
// Rerank scores are cached per (query, chunk) in .cache/rerank-scores.json, so repeat runs over the frozen eval
// index make no Cohere calls for queries already scored (see evals/prewarm-rerank.ts); --no-rerank-cache disables it.
// --save-baseline writes baselines/<label>-<goldenSha7>.json and refuses to overwrite an existing baseline;
// the label must belong to the system under test (rag-* for rag-v2.1, agentic-* for agentic-v1).
// The run aborts if the Cohere reranker is unavailable, and exits non-zero without saving a baseline if any row
// fell back to the unranked pool; --allow-no-rerank runs anyway and records it in the run metadata.
import { EVAL_COLLECTION, EVAL_TARGETS } from './lib/env.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { performance } from 'perf_hooks';
import {
  loadGolden,
  argValue,
  hasFlag,
  EVALS_DIR,
  type GoldenItem,
  type Category,
} from './lib/golden.js';
import { clonePath } from './lib/repoFiles.js';
import { checkCitation, type Citation, type CitationCheck } from './lib/citations.js';
import {
  retrievalMetrics,
  citationMetrics,
  mean,
  percentile,
  toContextDoc,
  evidenceToContextDoc,
  type ContextDoc,
  type RetrievalMetrics,
  type CitationMetrics,
} from './lib/metrics.js';
import {
  TokenUsageHandler,
  chatCost,
  estimateQueryEmbeddingTokens,
  PRICES,
  type ModelUsage,
} from './lib/tokens.js';
import { judgeAnswer, JUDGE_MODEL, type JudgeResult } from './lib/judge.js';
import { preflightRerank, ragRerankFellBack, agentRerankFallbacks, RERANK_CACHE_FILE } from './lib/rerank.js';
import { cohereApiKey } from '../src/config/cohere.js';
import { installRerankCache, rerankStats } from '../src/features/queries/rerank.js';
import type { AgentTrace } from '../src/features/agent/types.js';

const SYSTEMS = {
  'rag-v2.1': { baselinePrefix: 'rag-' },
  'rag-v2.2': { baselinePrefix: 'rag-' },
  'agentic-v1': { baselinePrefix: 'agentic-' },
  'agentic-v1.1': { baselinePrefix: 'agentic-' },
  'agentic-v1.2': { baselinePrefix: 'agentic-' },
} as const;
type SystemName = keyof typeof SYSTEMS;

interface ItemResult {
  id: string;
  system: SystemName;
  category: Category;
  repeat: number;
  question: string;
  error: string | null;
  answer: string;
  citations: Citation[];
  context: ContextDoc[];
  retrieval: RetrievalMetrics | null;
  citationChecks: CitationCheck[];
  citationMetrics: CitationMetrics;
  // Server-side citation assembly counts (RAG v2+); null for systems without the evidence layer.
  citationDiagnostics: Record<string, number> | null;
  judge: (Omit<JudgeResult, 'usage'>) | null;
  judgeError: string | null;
  latencyMs: number;
  usage: Record<string, ModelUsage>;
  estEmbeddingTokens: number;
  rerankSearches: number;
  // True when the pipeline answered from the unranked pool because the reranker failed.
  rerankFallback: boolean;
  costUsd: number;
  judgeCostUsd: number;
  // Agentic runs only.
  trace: AgentTrace | null;
}

const git = (cmd: string) => {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
};

const fmt = (x: number | null | undefined, digits = 3) =>
  x === null || x === undefined ? 'n/a' : x.toFixed(digits);
const pct = (x: number | null | undefined) =>
  x === null || x === undefined ? 'n/a' : `${(x * 100).toFixed(1)}%`;

const countBy = <T,>(xs: T[], key: (x: T) => string) =>
  xs.reduce<Record<string, number>>((acc, x) => {
    const k = key(x);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

// Rows recorded before traces carried diagnostics are derived from the saved context and citations (no token counts).
function rowDiagnostics(r: ItemResult) {
  if (!r.trace || r.error) return null;
  if (r.trace.diagnostics) return r.trace.diagnostics;
  const items = r.context.length;
  const shown = r.trace.answerEvidenceIds.length;
  const cited = new Set(r.citations.map((c) => (c as Citation & { evidenceId?: string }).evidenceId)).size;
  return {
    evidenceItems: items,
    uniqueFiles: new Set(r.context.map((d) => d.filePath)).size,
    evidenceTokens: null,
    answerEvidenceItems: shown,
    answerEvidenceTokens: null,
    citedEvidenceItems: cited,
    utilization: items ? cited / items : null,
    answerUtilization: shown ? cited / shown : null,
  };
}

function agentAggregate(results: ItemResult[]) {
  const traces = results.map((r) => r.trace).filter((t): t is AgentTrace => !!t);
  if (!traces.length) return null;
  const steps = traces.flatMap((t) => t.steps);
  const diags = results.map(rowDiagnostics).filter((d): d is NonNullable<typeof d> => !!d);
  const meanOf = (pick: (d: (typeof diags)[number]) => number | null) =>
    mean(diags.flatMap((d) => (pick(d) === null ? [] : [pick(d)!])));
  return {
    runs: traces.length,
    evidence: {
      items: meanOf((d) => d.evidenceItems),
      uniqueFiles: meanOf((d) => d.uniqueFiles),
      tokens: meanOf((d) => d.evidenceTokens),
      answerItems: meanOf((d) => d.answerEvidenceItems),
      citedItems: meanOf((d) => d.citedEvidenceItems),
      utilization: meanOf((d) => d.utilization),
      answerUtilization: meanOf((d) => d.answerUtilization),
    },
    toolCallsMean: mean(traces.map((t) => t.toolCalls)),
    toolCallsMax: Math.max(...traces.map((t) => t.toolCalls)),
    plannerCallsMean: mean(traces.map((t) => t.llmCalls.filter((c) => c.phase === 'plan').length)),
    terminationReasons: countBy(traces, (t) => t.terminationReason ?? 'error'),
    toolUsage: countBy(steps, (s) => s.tool),
    stepStatus: countBy(steps, (s) => s.status),
    retries: traces.reduce((s, t) => s + t.retries, 0),
    runsWithErrors: traces.filter((t) => t.errors.length).length,
    coverage: coverageAggregate(traces),
  };
}

// agentic-v1.1 subgoal tracking; null for profiles without it.
function coverageAggregate(traces: AgentTrace[]) {
  const withSubgoals = traces.filter((t) => t.subgoals);
  if (!withSubgoals.length) return null;
  const subgoals = withSubgoals.flatMap((t) => t.subgoals!);
  const rejections = withSubgoals.map((t) => (t.finishAttempts ?? []).filter((f) => !f.accepted).length);
  const ranSteps = withSubgoals.flatMap((t) => t.steps.filter((s) => s.status === 'ok'));
  return {
    subgoalsMean: mean(withSubgoals.map((t) => t.subgoals!.length)),
    subgoalCounts: countBy(withSubgoals, (t) => String(t.subgoals!.length)),
    multiSubgoalRuns: withSubgoals.filter((t) => t.subgoals!.length > 1).length,
    toolCallsPerSubgoal: mean(subgoals.map((s) => s.toolCalls)),
    evidencePerSubgoal: mean(subgoals.map((s) => s.gatheredEvidenceIds.length)),
    subgoalsWithoutOwnCall: subgoals.filter((s) => s.toolCalls === 0).length,
    // Calls tagged with more than one subgoal, whose evidence may support each of them.
    sharedEvidenceCalls: ranSteps.filter((s) => (s.subgoals?.length ?? 0) > 1).length,
    untaggedCalls: ranSteps.filter((s) => !s.subgoals?.length && s.subgoal === undefined).length,
    subgoalStatus: countBy(subgoals, (s) => s.status),
    finishRejections: rejections.reduce((s, n) => s + n, 0),
    runsWithRejectedFinish: rejections.filter((n) => n > 0).length,
    runsWithUnresolved: withSubgoals.filter((t) => t.subgoals!.some((s) => s.status === 'unresolved')).length,
    runsEndedWithOpenSubgoals: withSubgoals.filter((t) => t.subgoals!.some((s) => s.status === 'open')).length,
    decomposeFailures: withSubgoals.filter((t) => t.errors.some((e) => e.startsWith('decompose:'))).length,
  };
}

function aggregate(results: ItemResult[]) {
  const ok = results.filter((r) => !r.error);
  const judged = ok.filter((r) => r.judge);
  const allChecks = ok.flatMap((r) => r.citationChecks);
  const latencies = ok.map((r) => r.latencyMs);
  const usage = results.reduce(
    (acc, r) => {
      for (const u of Object.values(r.usage)) {
        acc.promptTokens += u.promptTokens;
        acc.completionTokens += u.completionTokens;
        acc.llmCalls += u.calls;
      }
      return acc;
    },
    { promptTokens: 0, completionTokens: 0, llmCalls: 0 },
  );
  const totalCost = results.reduce((s, r) => s + r.costUsd, 0);

  return {
    n: results.length,
    errors: results.length - ok.length,
    rerankFallbacks: results.filter((r) => r.rerankFallback).length,
    retrieval: {
      fileRecall: mean(ok.map((r) => r.retrieval!.fileRecall)),
      anyHitRate: mean(ok.map((r) => (r.retrieval!.anyHit ? 1 : 0))),
      rangeHitRate: mean(ok.map((r) => (r.retrieval!.rangeHit ? 1 : 0))),
      requiredRangeRecall: mean(ok.map((r) => r.retrieval!.requiredRangeRecall)),
      chunkedDocShare: mean(ok.flatMap((r) => r.context.map((d) => (d.chunked ? 1 : 0)))),
    },
    citations: {
      ...citationMetrics(allChecks),
      answersWithNoCitations: ok.filter((r) => r.citations.length === 0).length,
      assembly: ok.reduce<Record<string, number> | null>((acc, r) => {
        if (!r.citationDiagnostics) return acc;
        const sum = acc ?? {};
        for (const [k, v] of Object.entries(r.citationDiagnostics)) sum[k] = (sum[k] ?? 0) + v;
        return sum;
      }, null),
    },
    judge: {
      judged: judged.length,
      correctnessMean: mean(judged.map((r) => r.judge!.correctness)),
      correctRate: mean(judged.map((r) => (r.judge!.correctness === 2 ? 1 : 0))),
      wrongRate: mean(judged.map((r) => (r.judge!.correctness === 0 ? 1 : 0))),
      completenessMean: mean(judged.map((r) => r.judge!.completeness)),
    },
    latencyMs: {
      mean: mean(latencies),
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      max: latencies.length ? Math.max(...latencies) : null,
    },
    tokens: {
      ...usage,
      promptTokensPerQuestion: results.length ? usage.promptTokens / results.length : null,
      completionTokensPerQuestion: results.length ? usage.completionTokens / results.length : null,
    },
    costUsd: {
      total: totalCost,
      perQuestion: results.length ? totalCost / results.length : null,
      judgeTotal: results.reduce((s, r) => s + r.judgeCostUsd, 0),
    },
    agent: agentAggregate(results),
  };
}

type Summary = ReturnType<typeof aggregate>;

function summaryMarkdown(meta: Record<string, unknown>, overall: Summary, byCategory: Record<string, Summary>) {
  const rows = [['overall', overall] as const, ...Object.entries(byCategory)];
  const lines = [
    `# DevAI eval: ${meta.label ? `${meta.label} on ` : ''}${meta.goldenName}`,
    '',
    `- System: \`${meta.system}\``,
    `- Run: \`${meta.runId}\``,
    `- Golden repo: ${meta.repoUrl} @ \`${String(meta.goldenSha).slice(0, 7)}\``,
    `- System under test: DevAI \`${String(meta.codeSha).slice(0, 7)}\`${meta.codeDirty ? ' (uncommitted changes)' : ''}`,
    `- Collection: \`${meta.collection}\`, judge: \`${meta.judgeModel}\`, repeats: ${meta.repeats}`,
    ...(meta.rerank !== 'ok' ? [`- **Reranker: ${meta.rerank}**`] : []),
    ...(meta.cohere
      ? [
          `- Cohere rerank: ${(meta.cohere as typeof rerankStats).apiCalls} API calls (plus 1 preflight), ${(meta.cohere as typeof rerankStats).cachedScores} cached scores, ${(meta.cohere as typeof rerankStats).newScores} new, ${(meta.cohere as typeof rerankStats).failures} failures; cache: ${meta.rerankCache ?? 'off'}`,
        ]
      : []),
    ...(overall.rerankFallbacks && meta.rerank === 'ok'
      ? [`- **${overall.rerankFallbacks} of ${overall.n} rows fell back to the unranked pool (reranker failed mid-run); not comparable to reranked runs.**`]
      : []),
    '',
    '## Quality',
    '',
    '| Slice | N | Err | File recall | Any hit | Range hit | Citation valid | Cit. grounded | Cit. relevant | Correctness (0-2) | Correct % | Completeness |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(([name, s]) =>
      `| ${name} | ${s.n} | ${s.errors} | ${pct(s.retrieval.fileRecall)} | ${pct(s.retrieval.anyHitRate)} | ${pct(s.retrieval.rangeHitRate)} | ${pct(s.citations.validRate)} | ${pct(s.citations.groundedRate)} | ${pct(s.citations.relevantRate)} | ${fmt(s.judge.correctnessMean, 2)} | ${pct(s.judge.correctRate)} | ${pct(s.judge.completenessMean)} |`,
    ),
    '',
    '## Latency and cost',
    '',
    '| Slice | p50 ms | p95 ms | Mean ms | Prompt tok/q | Completion tok/q | Cost/q (USD) | Total (USD) |',
    '|---|---|---|---|---|---|---|---|',
    ...rows.map(([name, s]) =>
      `| ${name} | ${fmt(s.latencyMs.p50, 0)} | ${fmt(s.latencyMs.p95, 0)} | ${fmt(s.latencyMs.mean, 0)} | ${fmt(s.tokens.promptTokensPerQuestion, 0)} | ${fmt(s.tokens.completionTokensPerQuestion, 0)} | ${fmt(s.costUsd.perQuestion, 5)} | ${fmt(s.costUsd.total, 4)} |`,
    ),
    '',
    `Judge cost (not included above): $${fmt(overall.costUsd.judgeTotal, 4)}. Embedding tokens are estimated; chat tokens come from LangChain callbacks.`,
    '',
    String(meta.system).startsWith('agentic')
      ? 'For the agent, "retrieved" means all evidence gathered by its tools. Range hit requires an evidence item that overlaps the expected lines and spans at most max(60, 2x the expected range).'
      : `Range hit requires a retrieved doc that overlaps the expected lines and spans at most max(60, 2x the expected range). ${pct(overall.retrieval.chunkedDocShare)} of retrieved docs are split chunks.`,
    '',
  ];
  const ag = overall.agent;
  if (ag) {
    const fmtCounts = (c: Record<string, number>) =>
      Object.entries(c)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`)
        .join(', ');
    lines.push(
      '## Agent',
      '',
      '| Slice | Tool calls/q | Max | Planner calls/q | Evidence items/q | Unique files/q | Evidence tokens/q | Answer evidence/q | Cited items/q | Utilization (cited / gathered) |',
      '|---|---|---|---|---|---|---|---|---|---|',
      ...rows
        .filter(([, s]) => s.agent)
        .map(([name, s]) => {
          const a = s.agent!;
          return `| ${name} | ${fmt(a.toolCallsMean, 2)} | ${a.toolCallsMax} | ${fmt(a.plannerCallsMean, 2)} | ${fmt(a.evidence.items, 1)} | ${fmt(a.evidence.uniqueFiles, 1)} | ${fmt(a.evidence.tokens, 0)} | ${fmt(a.evidence.answerItems, 1)} | ${fmt(a.evidence.citedItems, 2)} | ${pct(a.evidence.utilization)} |`;
        }),
      '',
      `Termination: ${fmtCounts(ag.terminationReasons)}.`,
      '',
      `Tool usage: ${fmtCounts(ag.toolUsage)}. Step outcomes: ${fmtCounts(ag.stepStatus)}. Retries: ${ag.retries}. Runs with errors: ${ag.runsWithErrors}.`,
      '',
    );
    const c = ag.coverage;
    if (c) {
      lines.push(
        `Subgoals: ${fmt(c.subgoalsMean, 2)}/q (${c.multiSubgoalRuns} of ${ag.runs} runs split into several; runs by subgoal count: ${fmtCounts(c.subgoalCounts)}); final status ${fmtCounts(c.subgoalStatus)}. ` +
          `Per subgoal: ${fmt(c.toolCallsPerSubgoal, 2)} tool calls, ${fmt(c.evidencePerSubgoal, 1)} evidence items; ${c.subgoalsWithoutOwnCall} subgoals had no tool call of their own. ` +
          `Shared-evidence calls (tagged with 2+ subgoals): ${c.sharedEvidenceCalls} of ${ag.stepStatus.ok ?? 0} successful calls; untagged calls: ${c.untaggedCalls}. ` +
          `Finish rejected ${c.finishRejections} times in ${c.runsWithRejectedFinish} runs. Runs with unresolved subgoals: ${c.runsWithUnresolved}; ended with open subgoals: ${c.runsEndedWithOpenSubgoals}. Decomposition failures: ${c.decomposeFailures}.`,
        '',
      );
    }
  }
  const a = overall.citations.assembly;
  if (a) {
    lines.push(
      `Citation assembly: ${a.requested} requested by the model, ${a.emitted} emitted; dropped ${a.unknownEvidence} unknown evidence IDs, ${a.missingFile} missing files, ${a.emptyEvidence ?? 0} blank evidence items, ${a.duplicates} duplicates; ${a.clamped} ranges clamped, ${a.fullEvidenceFallback} missed their evidence and ${a.whitespaceFallback ?? 0} selected only blank lines (both fell back to the full evidence range).`,
      '',
    );
  }
  return lines.join('\n');
}

async function main() {
  const golden = loadGolden(argValue('golden'));
  const only = argValue('only')?.split(',').map((s) => s.trim());
  const category = argValue('category');
  const repeats = Number(argValue('repeats') ?? 1);
  const concurrency = Math.max(1, Number(argValue('concurrency') ?? 1));
  const useJudge = !hasFlag('no-judge');
  const verbose = hasFlag('verbose');
  const allowNoRerank = hasFlag('allow-no-rerank');
  if (!hasFlag('no-rerank-cache')) installRerankCache(RERANK_CACHE_FILE);

  const system = argValue('system') as SystemName | undefined;
  if (!system || !(system in SYSTEMS)) {
    throw new Error(`--system is required: one of ${Object.keys(SYSTEMS).join(', ')}`);
  }

  let baselineFile: string | null = null;
  const baselineLabel = argValue('save-baseline');
  if (hasFlag('save-baseline')) {
    if (!baselineLabel || baselineLabel.startsWith('--') || !/^[a-z0-9][a-z0-9._-]*$/i.test(baselineLabel)) {
      throw new Error('--save-baseline needs a version label, e.g. --save-baseline rag-v1');
    }
    if (!baselineLabel.startsWith(SYSTEMS[system].baselinePrefix)) {
      throw new Error(
        `Baseline label "${baselineLabel}" does not match --system ${system}; use a ${SYSTEMS[system].baselinePrefix}* label.`,
      );
    }
    baselineFile = path.join(
      EVALS_DIR,
      'baselines',
      `${baselineLabel}-${golden.sha.slice(0, 7)}.json`,
    );
    if (fs.existsSync(baselineFile)) {
      throw new Error(
        `Baseline ${path.relative(process.cwd(), baselineFile)} already exists. Baselines are historical records; use a new label.`,
      );
    }
  }

  const items = golden.items.filter(
    (i) => (!only || only.includes(i.id)) && (!category || i.category === category),
  );
  if (!items.length) throw new Error('No golden items match the filters');

  const root = clonePath(golden.repoId, golden.sha);
  if (!fs.existsSync(root)) {
    throw new Error(`Pinned clone missing at ${root}. Run npm run eval:ingest first.`);
  }

  const rerankProblem = await preflightRerank(cohereApiKey());
  if (rerankProblem && !allowNoRerank) {
    throw new Error(
      `Reranker unavailable (${rerankProblem}). Both pipelines would silently answer from the unranked pool; fix COHERE_API_KEY_TRIAL or pass --allow-no-rerank.`,
    );
  }

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const codeSha = git('rev-parse HEAD');
  const meta = {
    runId,
    system,
    label: baselineLabel ?? null,
    goldenName: golden.name,
    repoUrl: golden.repoUrl,
    goldenSha: golden.sha,
    codeSha,
    codeDirty: git('status --porcelain -- src') !== '',
    collection: EVAL_COLLECTION,
    targets: EVAL_TARGETS,
    judgeModel: useJudge ? JUDGE_MODEL : null,
    rerank: rerankProblem ? `disabled (${rerankProblem})` : 'ok',
    rerankCache: hasFlag('no-rerank-cache') ? null : path.relative(process.cwd(), RERANK_CACHE_FILE),
    cohere: null as null | typeof rerankStats,
    repeats,
    concurrency,
    filters: { only: only ?? null, category: category ?? null },
    prices: PRICES,
  };

  const outDir = path.join(EVALS_DIR, 'results', `${runId}_${system}_${codeSha.slice(0, 7)}`);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonlPath = path.join(outDir, 'results.jsonl');

  const appLog = fs.createWriteStream(path.join(outDir, 'app.log'));
  const out = (s: string) => process.stdout.write(`${s}\n`);
  if (!verbose) {
    console.log = (...args: unknown[]) => appLog.write(`${args.map(String).join(' ')}\n`);
    console.warn = console.log;
  }

  const { connectMongo } = await import('../src/config/db.js');
  const mongoose = await connectMongo();
  const { answerQuestion } = await import('../src/features/queries/rag.service.js');
  const { answerWithAgent, AgentError } = await import('../src/features/agent/agent.service.js');

  out(`System: ${system}`);
  out(`Eval targets: ${EVAL_TARGETS}`);
  out(`Running ${items.length} item(s) x ${repeats} repeat(s) -> ${path.relative(process.cwd(), outDir)}`);

  const jobs: { item: GoldenItem; repeat: number }[] = [];
  for (let r = 0; r < repeats; r++) for (const item of items) jobs.push({ item, repeat: r });

  const results: ItemResult[] = [];
  let cursor = 0;

  const runOne = async ({ item, repeat }: { item: GoldenItem; repeat: number }) => {
    const handler = new TokenUsageHandler();
    const sessionId = `eval_${runId}_${item.id}_${repeat}`;
    let error: string | null = null;
    let answer = '';
    let citations: Citation[] = [];
    let context: ContextDoc[] = [];
    let citationDiagnostics: ItemResult['citationDiagnostics'] = null;
    let trace: AgentTrace | null = null;

    const t0 = performance.now();
    try {
      if (!system.startsWith('rag-')) {
        const res = await answerWithAgent(golden.repoUrl, item.question, item.type, {
          profile: system as Exclude<SystemName, 'rag-v2.1' | 'rag-v2.2'>,
          callbacks: [handler],
        });
        trace = res.trace;
        if (res.trace.commitSha !== golden.sha.toLowerCase()) {
          throw new Error(`Agent snapshot ${res.trace.commitSha} is not the golden commit ${golden.sha}`);
        }
        answer = res.answer;
        citations = res.citations;
        context = res.allEvidence.map(evidenceToContextDoc);
        citationDiagnostics = res.citationDiagnostics;
      } else {
        const res = await answerQuestion(golden.repoUrl, item.question, item.type, sessionId, {
          callbacks: [handler],
          retrieval: system === 'rag-v2.2' ? 'v2.2' : 'v2.1',
        });
        const response = (res.result as any).response ?? {};
        answer = String(response.answer ?? '');
        citations = Array.isArray(response.citations) ? response.citations : [];
        context = ((res.result as any).context ?? []).map(toContextDoc);
        citationDiagnostics = (res.result as any).citationDiagnostics ?? null;
      }
    } catch (err: any) {
      error = err?.message ?? String(err);
      if (err instanceof AgentError) trace = err.trace;
    }
    const latencyMs = performance.now() - t0;

    const expectedFiles = new Set(item.expected_sources.map((s) => s.file));
    const citationChecks = error
      ? []
      : citations.map((c) => checkCitation(c, root, context, expectedFiles));

    let judge: ItemResult['judge'] = null;
    let judgeError: string | null = null;
    let judgeCostUsd = 0;
    if (useJudge && !error) {
      try {
        const { usage, ...rest } = await judgeAnswer(item, answer, citations);
        judge = rest;
        judgeCostUsd = chatCost(usage);
      } catch (err: any) {
        judgeError = err?.message ?? String(err);
      }
    }

    // Each semanticSearch attempt embeds its query (plus MultiQuery rewrites) and may run one rerank.
    const semanticAttempts = (trace?.steps ?? [])
      .filter((s) => s.tool === 'semanticSearch')
      .flatMap((s) => Array(s.attempts).fill(String(s.args.query ?? '')) as string[]);
    const estEmbeddingTokens = trace
      ? semanticAttempts.reduce((sum, q) => sum + estimateQueryEmbeddingTokens(q), 0)
      : error
        ? 0
        : estimateQueryEmbeddingTokens(item.question);
    const agentRerank = agentRerankFallbacks(trace);
    const ragTopN = system === 'rag-v2.2' ? 8 : 5;
    const rerankFallback = trace ? agentRerank.fallbacks > 0 : !error && ragRerankFellBack(context.length, ragTopN);
    // What production would pay per question (the eval cache can make the actual calls fewer).
    const rerankSearches = rerankProblem
      ? 0
      : trace
        ? Math.max(0, semanticAttempts.length - agentRerank.fallbacks)
        : !error && context.length && !rerankFallback
          ? system === 'rag-v2.2'
            ? 2
            : 1
          : 0;
    const costUsd =
      chatCost(handler.usage) +
      (estEmbeddingTokens / 1e6) * PRICES.embeddingPer1M +
      rerankSearches * PRICES.rerankPerSearch;

    const result: ItemResult = {
      id: item.id,
      system,
      category: item.category,
      repeat,
      question: item.question,
      error,
      answer,
      citations,
      context,
      retrieval: error ? null : retrievalMetrics(item, context),
      citationChecks,
      citationMetrics: citationMetrics(citationChecks),
      citationDiagnostics,
      judge,
      judgeError,
      latencyMs,
      usage: handler.usage,
      estEmbeddingTokens,
      rerankSearches,
      rerankFallback,
      costUsd,
      judgeCostUsd,
      trace,
    };
    results.push(result);
    fs.appendFileSync(jsonlPath, `${JSON.stringify(result)}\n`);

    const subgoalInfo = trace?.subgoals
      ? ` subgoals=${trace.subgoals.filter((s) => s.status === 'covered').length}/${trace.subgoals.length} finishRejected=${trace.finishAttempts.filter((f) => !f.accepted).length}`
      : '';
    const agentInfo = trace ? ` tools=${trace.toolCalls} stop=${trace.terminationReason ?? 'error'}${subgoalInfo}` : '';
    const rerankInfo = rerankFallback && !rerankProblem ? ' RERANK-FALLBACK' : '';
    out(
      error
        ? `${item.id}#${repeat} ERROR ${error}${agentInfo}`
        : `${item.id}#${repeat} recall=${pct(result.retrieval!.fileRecall)} cites=${citations.length} valid=${pct(result.citationMetrics.validRate)} correct=${judge?.correctness ?? (judgeError ? 'judge-err' : '-')} complete=${judge ? pct(judge.completeness) : '-'}${agentInfo}${rerankInfo} ${Math.round(latencyMs)}ms`,
    );
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
      while (cursor < jobs.length) await runOne(jobs[cursor++]);
    }),
  );

  results.sort((a, b) => a.id.localeCompare(b.id) || a.repeat - b.repeat);
  meta.cohere = { ...rerankStats };
  const overall = aggregate(results);
  const byCategory: Record<string, Summary> = {};
  for (const cat of [...new Set(results.map((r) => r.category))]) {
    byCategory[cat] = aggregate(results.filter((r) => r.category === cat));
  }

  const summary = { meta, overall, byCategory };
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  const md = summaryMarkdown(meta, overall, byCategory);
  fs.writeFileSync(path.join(outDir, 'summary.md'), md);
  out(`\n${md}`);

  if ((overall.rerankFallbacks || rerankStats.failures) && !allowNoRerank) {
    appLog.end();
    await mongoose.disconnect();
    throw new Error(
      `Reranker failed mid-run (${rerankStats.failures} failed calls; ${overall.rerankFallbacks} of ${overall.n} rows answered from the unranked pool)${baselineFile ? '; baseline not saved' : ''}. Results are in ${path.relative(process.cwd(), outDir)}.`,
    );
  }

  if (baselineFile) {
    fs.mkdirSync(path.dirname(baselineFile), { recursive: true });
    fs.writeFileSync(baselineFile, JSON.stringify({ ...summary, results }, null, 2), {
      flag: 'wx',
    });
    out(`Baseline saved to ${path.relative(process.cwd(), baselineFile)}`);
  }

  appLog.end();
  await mongoose.disconnect();
}

main().catch((err) => {
  process.stderr.write(`${err?.stack ?? err}\n`);
  process.exit(1);
});
