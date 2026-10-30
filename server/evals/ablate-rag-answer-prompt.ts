// Diagnostic: holds RAG v2.1's saved retrieval context constant and regenerates answers with two system prompts,
// the verbatim v2.1 Find prompt ("control") and the same prompt with its length cap replaced by a completeness
// instruction ("complete"), then judges both the same way.
// Usage: npx tsx evals/ablate-rag-answer-prompt.ts [--baseline rag-v2.1] [--only X01,M02] [--repeat 0]
//        [--concurrency 3] [--diagnosis .cache/missing-facts-diagnosis.json]
// Context text is the exact indexed chunk, fetched from the eval Qdrant collection by file and line range.
import { EVAL_TARGETS, EVAL_COLLECTION } from './lib/env.js';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Document } from '@langchain/core/documents';
import { loadGolden, argValue, EVALS_DIR, type GoldenItem } from './lib/golden.js';
import { clonePath } from './lib/repoFiles.js';
import { checkCitation } from './lib/citations.js';
import { citationMetrics, mean, type ContextDoc } from './lib/metrics.js';
import { judgeAnswer } from './lib/judge.js';
import { TokenUsageHandler, chatCost } from './lib/tokens.js';
import { buildEvidence, formatEvidence, assembleCitations, type Evidence } from '../src/features/queries/evidence.js';
import { SYSTEM_PROMPTS } from '../src/features/queries/prompts.js';
import { QdrantClient } from '@qdrant/js-client-rest';
import { retryAfterHintMs } from '../src/features/agent/agent.service.js';

type Arm = 'control' | 'complete';
const ARMS: Arm[] = ['control', 'complete'];

// --- RAG v2.1 prompts, read verbatim from rag.service.ts ---------------------------------------
const ragSource = fs.readFileSync(path.resolve('src/features/queries/rag.service.ts'), 'utf8');
const extract = (name: string) => {
  const m = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`).exec(ragSource);
  if (!m) throw new Error(`Could not find ${name} in rag.service.ts; update the ablation script`);
  return m[1].replace(/\\n/g, '\n');
};
const RAG_SYSTEM_TEMPLATE = extract('finalSystemPrompt');
const RAG_USER_TEMPLATE = extract('USERPROMPT');
const NO_HISTORY = 'No previous context. ,This is the start of the conversation.';
if (!ragSource.includes(`'${NO_HISTORY}'`)) throw new Error('RAG no-history text changed; update the ablation script');
const MAX_TOKENS = Number(/const MAX_TOKENS = ([\d_]+);/.exec(ragSource)?.[1].replace(/_/g, ''));
if (!MAX_TOKENS) throw new Error('Could not find MAX_TOKENS in rag.service.ts');

const LENGTH_CAP = '3. Summarise behaviour in ≤ 3 short paragraphs (≈ 60-120 words total).';
const COMPLETE_STEP =
  '3. Explain the behaviour completely: name every file, function, call, condition, return value and configuration value in the evidence that bears on the question, and for flows give every step in order. Be economical with words, not with facts.';
const findPrompt = (SYSTEM_PROMPTS as Record<string, { content: string }>).Find.content;
if (!findPrompt.includes(LENGTH_CAP)) throw new Error('Find prompt length cap changed; update the ablation script');

const systemPrompt = (arm: Arm) =>
  RAG_SYSTEM_TEMPLATE.replace('${selectedSystemPrompt}', arm === 'control' ? findPrompt : findPrompt.replace(LENGTH_CAP, COMPLETE_STEP)).replace(
    '${previousContext}',
    NO_HISTORY,
  );

const formatDoc = (d: Document) =>
  `FILE NAME: ${d.metadata.declarationName} \nFILE: ${d.metadata.filePath} (lines ${d.metadata.startLine}-${d.metadata.endLine})\n---\n${d.pageContent}\n====`;

// Same model, structured output and budget loop as rag.service generate().
const answerSchema = z.object({
  answer: z.string(),
  citations: z.array(z.object({ evidenceId: z.string(), startLine: z.number(), endLine: z.number() })),
});
const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0, maxRetries: 2 }).withStructuredOutput(answerSchema, {
  method: 'jsonSchema',
  strict: true,
});

async function withRetries<T>(work: () => Promise<T>, attempts = 6): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await work();
    } catch (err) {
      if (i + 1 >= attempts || !/429|rate limit|fetch failed|ECONNRESET|50[234]/i.test(String((err as Error)?.message))) throw err;
      await new Promise((r) => setTimeout(r, Math.max(2000 * 2 ** i, retryAfterHintMs(err))));
    }
  }
}

type BaselineRow = {
  id: string;
  category: string;
  repeat: number;
  question: string;
  error: string | null;
  answer: string;
  context: ContextDoc[];
  judge: { correctness: number; completeness: number; facts: { covered: boolean }[] } | null;
};

type ArmResult = {
  id: string;
  category: string;
  repeat: number;
  arm: Arm | 'original';
  error: string | null;
  answer: string;
  citations: number;
  validRate: number | null;
  correctness: number | null;
  completeness: number | null;
  factsCovered: boolean[] | null;
  costUsd: number;
};

async function main() {
  const golden = loadGolden(argValue('golden'));
  const label = argValue('baseline') ?? 'rag-v2.1';
  const only = argValue('only')?.split(',').map((s) => s.trim());
  const repeatFilter = argValue('repeat');
  const concurrency = Math.max(1, Number(argValue('concurrency') ?? 3));
  const diagnosisPath = argValue('diagnosis') ?? '.cache/missing-facts-diagnosis.json';

  const baselinePath = path.join(EVALS_DIR, 'baselines', `${label}-${golden.sha.slice(0, 7)}.json`);
  const baseline: { results: BaselineRow[] } = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const items = new Map<string, GoldenItem>(golden.items.map((i) => [i.id, i]));
  const rows = baseline.results.filter(
    (r) => !r.error && (!only || only.includes(r.id)) && (repeatFilter === undefined || r.repeat === Number(repeatFilter)),
  );
  const root = clonePath(golden.repoId, golden.sha);
  const snapshotLines = new Map<string, string[]>();
  const readLines = (file: string) => {
    if (!snapshotLines.has(file)) snapshotLines.set(file, fs.readFileSync(path.join(root, file), 'utf8').split('\n'));
    return snapshotLines.get(file)!;
  };

  // --- Exact chunk text from the eval collection ---------------------------------------------
  const qdrant = new QdrantClient({ url: process.env.QDRANT_URL!, apiKey: process.env.QDRANT_API_KEY || undefined });
  const chunkCache = new Map<string, Document>();
  let snapshotFallbacks = 0;
  const chunkFor = async (d: ContextDoc): Promise<Document> => {
    const key = `${d.filePath}:${d.startLine}-${d.endLine}`;
    if (chunkCache.has(key)) return chunkCache.get(key)!;
    const res = await qdrant.scroll(EVAL_COLLECTION, {
      filter: {
        must: [
          { key: 'metadata.repoId', match: { value: golden.repoId } },
          { key: 'metadata.filePath', match: { value: d.filePath } },
          { key: 'metadata.startLine', match: { value: d.startLine } },
          { key: 'metadata.endLine', match: { value: d.endLine } },
        ],
      },
      limit: 4,
      with_payload: true,
      with_vector: false,
    });
    const hit = res.points.find((p: { payload?: Record<string, unknown> | null }) => p.payload?.content !== undefined);
    let doc: Document;
    if (hit) {
      const p = hit.payload as { content: string; metadata: Record<string, unknown> };
      doc = new Document({ pageContent: p.content, metadata: p.metadata });
    } else {
      snapshotFallbacks++;
      doc = new Document({
        pageContent: readLines(d.filePath).slice(d.startLine - 1, d.endLine).join('\n'),
        metadata: { ...d, chunked: true, repoId: golden.repoId, commitSha: golden.sha },
      });
    }
    chunkCache.set(key, doc);
    return doc;
  };

  const diagnosis: { rows: { id: string; repeat: number; fact: string; covered: boolean | null; verdict: string }[] } | null =
    fs.existsSync(diagnosisPath) ? JSON.parse(fs.readFileSync(diagnosisPath, 'utf8')) : null;

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(EVALS_DIR, 'results', `${runId}_ablation-rag-answer-prompt_${label}`);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonl = path.join(outDir, 'results.jsonl');
  process.stdout.write(
    `Eval targets: ${EVAL_TARGETS}\nAblating ${rows.length} rows from ${path.relative(process.cwd(), baselinePath)} -> ${path.relative(process.cwd(), outDir)}\n`,
  );

  const results: ArmResult[] = [];
  const runRow = async (row: BaselineRow) => {
    const item = items.get(row.id)!;
    const docs = await Promise.all(row.context.map(chunkFor));
    const allEvidence = buildEvidence(docs, golden.repoId);
    const evidence: Evidence[] = [];
    let budgetBody = '';
    let promptBody = '';
    for (const [i, doc] of docs.entries()) {
      const next = formatDoc(doc);
      if (Math.ceil((budgetBody + next).length / 4) > MAX_TOKENS) break;
      budgetBody += next;
      evidence.push(allEvidence[i]);
      promptBody += formatEvidence(allEvidence[i], doc.metadata.declarationName as string | undefined);
    }

    results.push({
      id: row.id,
      category: row.category,
      repeat: row.repeat,
      arm: 'original',
      error: null,
      answer: row.answer,
      citations: 0,
      validRate: null,
      correctness: row.judge?.correctness ?? null,
      completeness: row.judge?.completeness ?? null,
      factsCovered: row.judge?.facts.map((f) => f.covered) ?? null,
      costUsd: 0,
    });

    const expected = new Set(item.expected_sources.map((s) => s.file));
    const line: string[] = [];
    for (const arm of ARMS) {
      const handler = new TokenUsageHandler();
      const res: ArmResult = {
        id: row.id,
        category: row.category,
        repeat: row.repeat,
        arm,
        error: null,
        answer: '',
        citations: 0,
        validRate: null,
        correctness: null,
        completeness: null,
        factsCovered: null,
        costUsd: 0,
      };
      try {
        const messages = await ChatPromptTemplate.fromMessages([
          ['system', systemPrompt(arm)],
          ['user', RAG_USER_TEMPLATE],
        ]).formatMessages({ question: row.question, context: promptBody });
        const draft = await withRetries(() => llm.invoke(messages, { callbacks: [handler] }));
        const { citations } = assembleCitations(draft.citations, evidence, () => root);
        res.answer = draft.answer;
        res.citations = citations.length;
        const checks = citations.map((c) => checkCitation(c, root, row.context, expected));
        res.validRate = checks.length ? citationMetrics(checks).validRate : null;
        const j = await withRetries(() => judgeAnswer(item, draft.answer, citations));
        res.correctness = j.correctness;
        res.completeness = j.completeness;
        res.factsCovered = j.facts.map((f) => f.covered);
        res.costUsd = chatCost(handler.usage) + chatCost(j.usage);
      } catch (err) {
        res.error = String((err as Error)?.message ?? err).split('\n')[0];
      }
      results.push(res);
      fs.appendFileSync(jsonl, `${JSON.stringify(res)}\n`);
      line.push(`${arm}=${res.error ? 'ERR' : `${res.correctness}/${Math.round(res.completeness! * 100)}% ${res.answer.length}ch`}`);
    }
    process.stdout.write(`${row.id}#${row.repeat} original=${row.judge?.correctness}/${Math.round((row.judge?.completeness ?? 0) * 100)}% ${line.join(' ')}\n`);
  };

  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
      while (cursor < rows.length) await runRow(rows[cursor++]);
    }),
  );

  // --- Summary -----------------------------------------------------------------------------------
  const key = (r: { id: string; repeat: number }) => `${r.id}#${r.repeat}`;
  const ok = (arm: ArmResult['arm'], cat: string) =>
    results.filter((r) => r.arm === arm && !r.error && r.correctness !== null && (cat === 'overall' || r.category === cat));
  const f2 = (x: number | null) => (x === null ? 'n/a' : x.toFixed(2));
  const pc = (x: number | null) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
  const cats = ['overall', ...[...new Set(rows.map((r) => r.category))].sort()];
  const table = [
    '| Slice | N | Original (baseline answer) | Control (v2.1 prompt, regenerated) | Complete prompt | Paired complete − control: Δcorrectness, Δcompleteness, better / tie / worse |',
    '|---|---|---|---|---|---|',
  ];
  const summary: Record<string, unknown> = {};
  for (const cat of cats) {
    const stat = (arm: ArmResult['arm']) => {
      const rs = ok(arm, cat);
      return {
        n: rs.length,
        correctness: mean(rs.map((r) => r.correctness!)),
        correctRate: mean(rs.map((r) => (r.correctness === 2 ? 1 : 0))),
        wrongRate: mean(rs.map((r) => (r.correctness === 0 ? 1 : 0))),
        completeness: mean(rs.map((r) => r.completeness!)),
        answerChars: mean(rs.map((r) => r.answer.length)),
      };
    };
    const stats = { original: stat('original'), control: stat('control'), complete: stat('complete') };
    const controlBy = new Map(ok('control', cat).map((r) => [key(r), r]));
    const pairs = ok('complete', cat)
      .map((r) => [controlBy.get(key(r)), r] as const)
      .filter(([a]) => a) as [ArmResult, ArmResult][];
    const paired = {
      n: pairs.length,
      dCorrectness: mean(pairs.map(([a, b]) => b.correctness! - a.correctness!)),
      dCompleteness: mean(pairs.map(([a, b]) => b.completeness! - a.completeness!)),
      better: pairs.filter(([a, b]) => b.correctness! > a.correctness!).length,
      tie: pairs.filter(([a, b]) => b.correctness! === a.correctness!).length,
      worse: pairs.filter(([a, b]) => b.correctness! < a.correctness!).length,
    };
    summary[cat] = { ...stats, paired };
    const cell = (s: ReturnType<typeof stat>) => `${f2(s.correctness)} / ${pc(s.correctRate)} / ${pc(s.completeness)}`;
    table.push(
      `| ${cat} | ${paired.n} | ${cell(stats.original)} | ${cell(stats.control)} | ${cell(stats.complete)} | ${f2(paired.dCorrectness)}, ${paired.dCompleteness === null ? 'n/a' : `${(paired.dCompleteness * 100).toFixed(1)} pts`}, ${paired.better} / ${paired.tie} / ${paired.worse} |`,
    );
  }

  // Recovery of facts the baseline answer missed, split by whether the diagnosis found them in the context.
  const recovery: string[] = [];
  if (diagnosis) {
    const byRow = new Map<string, { fact: string; covered: boolean | null; verdict: string }[]>();
    for (const d of diagnosis.rows) {
      const k = key(d);
      if (!byRow.has(k)) byRow.set(k, []);
      byRow.get(k)!.push(d);
    }
    for (const arm of ARMS) {
      const counts: Record<string, { n: number; recovered: number }> = {};
      const lost = { n: 0, lost: 0 };
      for (const r of ok(arm, 'overall')) {
        const facts = byRow.get(key(r));
        if (!facts || !r.factsCovered || r.factsCovered.length !== facts.length) continue;
        facts.forEach((f, i) => {
          if (f.covered === false) {
            counts[f.verdict] ??= { n: 0, recovered: 0 };
            counts[f.verdict].n++;
            if (r.factsCovered![i]) counts[f.verdict].recovered++;
          } else if (f.covered === true) {
            lost.n++;
            if (!r.factsCovered![i]) lost.lost++;
          }
        });
      }
      recovery.push(
        `- ${arm}: baseline-missed facts now covered — ${['present', 'partial', 'absent']
          .map((v) => `${v} in context ${counts[v]?.recovered ?? 0}/${counts[v]?.n ?? 0} (${pc(counts[v] ? counts[v].recovered / counts[v].n : null)})`)
          .join(', ')}; baseline-covered facts now missed ${lost.lost}/${lost.n} (${pc(lost.n ? lost.lost / lost.n : null)})`,
      );
    }
  }

  const o = summary.overall as Record<Arm | 'original', { answerChars: number | null; wrongRate: number | null }>;
  const md = [
    `# RAG answer-prompt ablation on ${label}`,
    '',
    `- Run: \`${runId}\`, rows: ${rows.length}, judge: gpt-4o. Context held constant (exact indexed chunks; ${snapshotFallbacks} snapshot fallbacks).`,
    `- Control = verbatim v2.1 prompts, regenerated; its gap to Original is sampling noise. Complete = v2.1 with Find step 3 ("${LENGTH_CAP}") replaced by: "${COMPLETE_STEP}"`,
    '- Cells: correctness (0–2) / fully correct % / completeness.',
    '',
    ...table,
    '',
    `Wrong rate: original ${pc(o.original.wrongRate)}, control ${pc(o.control.wrongRate)}, complete ${pc(o.complete.wrongRate)}. Mean answer length: original ${o.original.answerChars?.toFixed(0)}, control ${o.control.answerChars?.toFixed(0)}, complete ${o.complete.answerChars?.toFixed(0)} chars.`,
    '',
    ...(recovery.length ? ['Fact recovery against the missing-facts diagnosis:', ...recovery, ''] : []),
    `Cost (answers + judge): $${results.reduce((s, r) => s + r.costUsd, 0).toFixed(3)}. Errors: ${results.filter((r) => r.error).length}.`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({ baseline: label, runId, snapshotFallbacks, summary }, null, 2));
  fs.writeFileSync(path.join(outDir, 'summary.md'), md);
  process.stdout.write(`\n${md}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err?.stack ?? err}\n`);
  process.exit(1);
});
