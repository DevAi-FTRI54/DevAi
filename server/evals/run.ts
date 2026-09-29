// Runs the golden set through answerQuestion and records retrieval, citation, judge, latency, and cost metrics.
// Usage: npm run eval:run -- [--only E01,X03] [--category cross_file] [--repeats 1]
//        [--concurrency 1] [--no-judge] [--verbose] [--save-baseline] [--golden path]
import { EVAL_COLLECTION } from './lib/env.js';
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

interface ItemResult {
  id: string;
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
  judge: (Omit<JudgeResult, 'usage'>) | null;
  judgeError: string | null;
  latencyMs: number;
  usage: Record<string, ModelUsage>;
  estEmbeddingTokens: number;
  rerankSearches: number;
  costUsd: number;
  judgeCostUsd: number;
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
  };
}

type Summary = ReturnType<typeof aggregate>;

function summaryMarkdown(meta: Record<string, unknown>, overall: Summary, byCategory: Record<string, Summary>) {
  const rows = [['overall', overall] as const, ...Object.entries(byCategory)];
  const lines = [
    `# DevAI eval: ${meta.goldenName}`,
    '',
    `- Run: \`${meta.runId}\``,
    `- Golden repo: ${meta.repoUrl} @ \`${String(meta.goldenSha).slice(0, 7)}\``,
    `- System under test: DevAI \`${String(meta.codeSha).slice(0, 7)}\`${meta.codeDirty ? ' (uncommitted changes)' : ''}`,
    `- Collection: \`${meta.collection}\`, judge: \`${meta.judgeModel}\`, repeats: ${meta.repeats}`,
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
    `Range hit requires a retrieved doc that overlaps the expected lines and spans at most max(60, 2x the expected range). ${pct(overall.retrieval.chunkedDocShare)} of retrieved docs are split chunks whose metadata still shows the parent document's full line range to the model.`,
    '',
  ];
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

  const items = golden.items.filter(
    (i) => (!only || only.includes(i.id)) && (!category || i.category === category),
  );
  if (!items.length) throw new Error('No golden items match the filters');

  const root = clonePath(golden.repoId, golden.sha);
  if (!fs.existsSync(root)) {
    throw new Error(`Pinned clone missing at ${root}. Run npm run eval:ingest first.`);
  }

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const codeSha = git('rev-parse HEAD');
  const meta = {
    runId,
    goldenName: golden.name,
    repoUrl: golden.repoUrl,
    goldenSha: golden.sha,
    codeSha,
    codeDirty: git('status --porcelain -- src') !== '',
    collection: EVAL_COLLECTION,
    judgeModel: useJudge ? JUDGE_MODEL : null,
    repeats,
    concurrency,
    filters: { only: only ?? null, category: category ?? null },
    prices: PRICES,
  };

  const outDir = path.join(EVALS_DIR, 'results', `${runId}_${codeSha.slice(0, 7)}`);
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

    const t0 = performance.now();
    try {
      const res = await answerQuestion(golden.repoUrl, item.question, item.type, sessionId, {
        callbacks: [handler],
      });
      const response = (res.result as any).response ?? {};
      answer = String(response.answer ?? '');
      citations = Array.isArray(response.citations) ? response.citations : [];
      context = ((res.result as any).context ?? []).map(toContextDoc);
    } catch (err: any) {
      error = err?.message ?? String(err);
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

    const estEmbeddingTokens = error ? 0 : estimateQueryEmbeddingTokens(item.question);
    const rerankSearches = !error && context.length && process.env.COHERE_API_KEY ? 1 : 0;
    const costUsd =
      chatCost(handler.usage) +
      (estEmbeddingTokens / 1e6) * PRICES.embeddingPer1M +
      rerankSearches * PRICES.rerankPerSearch;

    const result: ItemResult = {
      id: item.id,
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
      judge,
      judgeError,
      latencyMs,
      usage: handler.usage,
      estEmbeddingTokens,
      rerankSearches,
      costUsd,
      judgeCostUsd,
    };
    results.push(result);
    fs.appendFileSync(jsonlPath, `${JSON.stringify(result)}\n`);

    out(
      error
        ? `${item.id}#${repeat} ERROR ${error}`
        : `${item.id}#${repeat} recall=${pct(result.retrieval!.fileRecall)} cites=${citations.length} valid=${pct(result.citationMetrics.validRate)} correct=${judge?.correctness ?? (judgeError ? 'judge-err' : '-')} complete=${judge ? pct(judge.completeness) : '-'} ${Math.round(latencyMs)}ms`,
    );
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
      while (cursor < jobs.length) await runOne(jobs[cursor++]);
    }),
  );

  results.sort((a, b) => a.id.localeCompare(b.id) || a.repeat - b.repeat);
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

  if (hasFlag('save-baseline')) {
    const baselineDir = path.join(EVALS_DIR, 'baselines');
    fs.mkdirSync(baselineDir, { recursive: true });
    const file = path.join(baselineDir, `baseline-${golden.sha.slice(0, 7)}.json`);
    fs.writeFileSync(file, JSON.stringify({ ...summary, results }, null, 2));
    out(`Baseline saved to ${path.relative(process.cwd(), file)}`);
  }

  appLog.end();
  await mongoose.disconnect();
}

main().catch((err) => {
  process.stderr.write(`${err?.stack ?? err}\n`);
  process.exit(1);
});
