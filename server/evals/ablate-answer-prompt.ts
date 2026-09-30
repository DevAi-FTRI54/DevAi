// Diagnostic: holds saved agent evidence constant and regenerates answers with two answer prompts,
// the Agentic v1 answer prompt and the RAG v2.1 generation prompt, then scores both the same way.
// Usage: npx tsx evals/ablate-answer-prompt.ts [--baseline agentic-v1] [--only X01,M02] [--repeat 0]
//        [--concurrency 4] [--no-judge] [--results evals/results/<run dir>]
// --results reads an unsaved run's results.jsonl instead of the baseline.
// Evidence is rebuilt from the baseline rows (file, line range, label, order => same E-ids) by re-reading
// the pinned snapshot, which is where the agent's evidence text came from in the first place.
import { EVAL_TARGETS } from './lib/env.js';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import { loadGolden, argValue, hasFlag, EVALS_DIR, type GoldenItem } from './lib/golden.js';
import { clonePath } from './lib/repoFiles.js';
import { checkCitation, type Citation } from './lib/citations.js';
import { citationMetrics, mean } from './lib/metrics.js';
import { judgeAnswer } from './lib/judge.js';
import { TokenUsageHandler, chatCost } from './lib/tokens.js';
import { RepoSnapshot, EvidenceStore } from '../src/features/tools/index.js';
import { formatEvidence, type Evidence } from '../src/features/queries/evidence.js';
import { SYSTEM_PROMPTS } from '../src/features/queries/prompts.js';
import { answerSystemPrompt, answerUserPrompt } from '../src/features/agent/answerer.js';
import { retryAfterHintMs } from '../src/features/agent/agent.service.js';

type Arm = 'agent-prompt' | 'rag-prompt';
const ARMS: Arm[] = ['agent-prompt', 'rag-prompt'];

// --- RAG v2.1 prompt, read verbatim from rag.service.ts ----------------------------------------
const ragSource = fs.readFileSync(path.resolve('src/features/queries/rag.service.ts'), 'utf8');
const extract = (name: string) => {
  const m = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`).exec(ragSource);
  if (!m) throw new Error(`Could not find ${name} in rag.service.ts; update the ablation script`);
  return m[1].replace(/\\n/g, '\n');
};
const RAG_SYSTEM_TEMPLATE = extract('finalSystemPrompt');
const RAG_USER_TEMPLATE = extract('USERPROMPT');
// formatConversationHistory() output for a fresh session, which every eval run uses.
const NO_HISTORY = 'No previous context. ,This is the start of the conversation.';
if (!ragSource.includes(`'${NO_HISTORY}'`)) throw new Error('RAG no-history text changed; update the ablation script');

function ragSystemPrompt(type: string): string {
  const prompts = SYSTEM_PROMPTS as Record<string, { content: string }>;
  const key = Object.keys(prompts).find((k) => k.toLowerCase() === type.toLowerCase()) ?? 'Find';
  return RAG_SYSTEM_TEMPLATE.replace('${selectedSystemPrompt}', prompts[key].content).replace(
    '${previousContext}',
    NO_HISTORY,
  );
}

async function ragMessages(type: string, question: string, evidence: Evidence[]): Promise<BaseMessage[]> {
  // rag.service concatenates formatEvidence() blocks and formats through ChatPromptTemplate.
  const context = evidence.map((e) => formatEvidence(e, e.label)).join('');
  const template = ChatPromptTemplate.fromMessages([
    ['system', ragSystemPrompt(type)],
    ['user', RAG_USER_TEMPLATE],
  ]);
  return template.formatMessages({ question, context });
}

function agentMessages(type: string, question: string, store: EvidenceStore, evidence: Evidence[]): BaseMessage[] {
  return [new SystemMessage(answerSystemPrompt(type)), new HumanMessage(answerUserPrompt(question, store.format(evidence)))];
}

// Same model and structured output as both production answer steps.
const answerSchema = z.object({
  answer: z.string(),
  citations: z.array(z.object({ evidenceId: z.string(), startLine: z.number(), endLine: z.number() })),
});
const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0, maxRetries: 2 }).withStructuredOutput(answerSchema, {
  method: 'jsonSchema',
  strict: true,
});

async function withRetries<T>(work: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await work();
    } catch (err) {
      if (i + 1 >= attempts || !/429|rate limit|fetch failed|ECONNRESET|50[234]/i.test(String((err as Error)?.message))) throw err;
      await new Promise((r) => setTimeout(r, Math.max(1000 * 2 ** i, retryAfterHintMs(err))));
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
  citations: (Citation & { evidenceId?: string })[];
  context: { filePath: string; startLine: number; endLine: number; declarationName?: string }[];
  judge: { correctness: number; completeness: number } | null;
  trace: { answerEvidenceIds: string[]; repoId: string; commitSha: string } | null;
};

type ArmResult = {
  id: string;
  category: string;
  repeat: number;
  arm: Arm | 'original';
  error: string | null;
  answer: string;
  citations: (Citation & { evidenceId?: string })[];
  citedEvidenceIds: string[];
  shownEvidence: number;
  validRate: number | null;
  correctness: number | null;
  completeness: number | null;
  costUsd: number;
};

async function main() {
  const golden = loadGolden(argValue('golden'));
  const label = argValue('baseline') ?? 'agentic-v1';
  const only = argValue('only')?.split(',').map((s) => s.trim());
  const repeatFilter = argValue('repeat');
  const concurrency = Math.max(1, Number(argValue('concurrency') ?? 4));
  const useJudge = !hasFlag('no-judge');

  const resultsDir = argValue('results');
  const baselinePath = resultsDir
    ? path.resolve(resultsDir, 'results.jsonl')
    : path.join(EVALS_DIR, 'baselines', `${label}-${golden.sha.slice(0, 7)}.json`);
  const baseline: { results: BaselineRow[] } = resultsDir
    ? {
        results: fs
          .readFileSync(baselinePath, 'utf8')
          .trim()
          .split('\n')
          .map((l) => JSON.parse(l) as BaselineRow),
      }
    : JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const items = new Map<string, GoldenItem>(golden.items.map((i) => [i.id, i]));
  const rows = baseline.results.filter(
    (r) => !r.error && r.trace && (!only || only.includes(r.id)) && (repeatFilter === undefined || r.repeat === Number(repeatFilter)),
  );

  const root = clonePath(golden.repoId, golden.sha);
  const snapshot = new RepoSnapshot(golden.repoId, golden.sha, root);
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(EVALS_DIR, 'results', `${runId}_ablation-answer-prompt_${label}`);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonl = path.join(outDir, 'results.jsonl');
  process.stdout.write(`Eval targets: ${EVAL_TARGETS}\nAblating ${rows.length} rows from ${path.relative(process.cwd(), baselinePath)} -> ${path.relative(process.cwd(), outDir)}\n`);

  const results: ArmResult[] = [];
  let reconstructionMismatches = 0;

  const score = async (row: BaselineRow, item: GoldenItem, arm: ArmResult['arm'], answer: string, citations: Citation[], context: ReturnType<typeof contextDocs>, shown: number, citedIds: string[], cost: number, error: string | null) => {
    const expected = new Set(item.expected_sources.map((s) => s.file));
    const checks = citations.map((c) => checkCitation(c, root, context, expected));
    let judge = null as null | { correctness: number; completeness: number };
    let judgeCost = 0;
    if (useJudge && !error) {
      const j = await withRetries(() => judgeAnswer(item, answer, citations));
      judge = j;
      judgeCost = chatCost(j.usage);
    }
    const res: ArmResult = {
      id: row.id,
      category: row.category,
      repeat: row.repeat,
      arm,
      error,
      answer,
      citations,
      citedEvidenceIds: citedIds,
      shownEvidence: shown,
      validRate: checks.length ? citationMetrics(checks).validRate : null,
      correctness: judge?.correctness ?? null,
      completeness: judge?.completeness ?? null,
      costUsd: cost + judgeCost,
    };
    results.push(res);
    fs.appendFileSync(jsonl, `${JSON.stringify(res)}\n`);
    return res;
  };

  const contextDocs = (row: BaselineRow) =>
    row.context.map((d) => ({ ...d, spanStart: d.startLine, spanEnd: d.endLine, chunked: false }));

  const runRow = async (row: BaselineRow) => {
    const item = items.get(row.id)!;
    const store = EvidenceStore.forSnapshot(snapshot);
    const all = store.add(
      row.context.map((d) => ({
        ...snapshot.evidence(d.filePath, d.startLine, d.endLine, 'semanticSearch', d.declarationName),
      })),
    );
    if (all.length !== row.context.length || all.some((e, i) => e.id !== `E${i + 1}`)) {
      throw new Error(`${row.id}#${row.repeat}: evidence reconstruction produced different IDs`);
    }
    // The original citations were copied from the same snapshot text; any difference means the rebuild drifted.
    for (const c of row.citations) {
      const ev = all.find((e) => e.id === c.evidenceId);
      const lines = snapshot.readLines(c.file).slice(c.startLine - 1, c.endLine).join('\n');
      if (!ev || lines !== c.snippet) reconstructionMismatches++;
    }
    const byId = new Map(all.map((e) => [e.id, e]));
    const shown = row.trace!.answerEvidenceIds.map((id) => byId.get(id)!).filter(Boolean);
    const context = contextDocs(row);

    // The baseline's own answer, scored by the baseline judge, as a noise reference.
    results.push({
      id: row.id,
      category: row.category,
      repeat: row.repeat,
      arm: 'original',
      error: null,
      answer: row.answer,
      citations: row.citations,
      citedEvidenceIds: [...new Set(row.citations.map((c) => c.evidenceId ?? ''))].filter(Boolean),
      shownEvidence: shown.length,
      validRate: null,
      correctness: row.judge?.correctness ?? null,
      completeness: row.judge?.completeness ?? null,
      costUsd: 0,
    });

    const line: string[] = [];
    for (const arm of ARMS) {
      const handler = new TokenUsageHandler();
      let answer = '';
      let citations: Citation[] = [];
      let citedIds: string[] = [];
      let error: string | null = null;
      try {
        const messages =
          arm === 'rag-prompt'
            ? await ragMessages(item.type, row.question, shown)
            : agentMessages(item.type, row.question, store, shown);
        const draft = await withRetries(() => llm.invoke(messages, { callbacks: [handler] }));
        const cited = store.cite(draft.citations, shown);
        answer = draft.answer;
        citations = cited.citations;
        citedIds = [...new Set(cited.citations.map((c) => c.evidenceId))];
      } catch (err) {
        error = String((err as Error)?.message ?? err);
      }
      const r = await score(row, item, arm, answer, citations, context, shown.length, citedIds, chatCost(handler.usage), error);
      line.push(`${arm}=${r.error ? 'ERR' : `${r.correctness ?? '-'}/${r.completeness === null ? '-' : Math.round(r.completeness * 100)}%`}`);
    }
    process.stdout.write(`${row.id}#${row.repeat} original=${row.judge?.correctness ?? '-'} ${line.join(' ')}\n`);
  };

  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
      while (cursor < rows.length) await runRow(rows[cursor++]);
    }),
  );

  // --- Summary -----------------------------------------------------------------------------------
  const arms: ArmResult['arm'][] = ['original', ...ARMS];
  const cats = ['overall', ...[...new Set(rows.map((r) => r.category))].sort()];
  const pick = (cat: string, arm: ArmResult['arm']) =>
    results.filter((r) => r.arm === arm && !r.error && (cat === 'overall' || r.category === cat));
  const f2 = (x: number | null) => (x === null ? 'n/a' : x.toFixed(2));
  const pc = (x: number | null) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);

  const summary: Record<string, Record<string, unknown>> = {};
  const table = [
    '| Slice | N | Original: correctness / correct % / completeness | Agent prompt | RAG v2.1 prompt | Paired (RAG − agent): Δcorrectness, Δcompleteness, RAG better / tie / worse |',
    '|---|---|---|---|---|---|',
  ];
  for (const cat of cats) {
    const stats = Object.fromEntries(
      arms.map((arm) => {
        const rs = pick(cat, arm).filter((r) => r.correctness !== null);
        return [
          arm,
          {
            n: rs.length,
            correctness: mean(rs.map((r) => r.correctness!)),
            correctRate: mean(rs.map((r) => (r.correctness === 2 ? 1 : 0))),
            completeness: mean(rs.map((r) => r.completeness!)),
            citationValid: mean(pick(cat, arm).flatMap((r) => (r.validRate === null ? [] : [r.validRate]))),
            citationsPerAnswer: mean(pick(cat, arm).map((r) => r.citations.length)),
            utilization: mean(pick(cat, arm).map((r) => (r.shownEvidence ? r.citedEvidenceIds.length / r.shownEvidence : 0))),
          },
        ];
      }),
    );
    const key = (r: ArmResult) => `${r.id}#${r.repeat}`;
    const agentBy = new Map(pick(cat, 'agent-prompt').map((r) => [key(r), r]));
    const pairs = pick(cat, 'rag-prompt')
      .map((r) => [agentBy.get(key(r)), r] as const)
      .filter(([a, b]) => a && a.correctness !== null && b.correctness !== null) as [ArmResult, ArmResult][];
    const paired = {
      n: pairs.length,
      dCorrectness: mean(pairs.map(([a, b]) => b.correctness! - a.correctness!)),
      dCompleteness: mean(pairs.map(([a, b]) => b.completeness! - a.completeness!)),
      ragBetter: pairs.filter(([a, b]) => b.correctness! > a.correctness!).length,
      tie: pairs.filter(([a, b]) => b.correctness! === a.correctness!).length,
      ragWorse: pairs.filter(([a, b]) => b.correctness! < a.correctness!).length,
    };
    summary[cat] = { ...stats, paired };
    const cell = (s: { correctness: number | null; correctRate: number | null; completeness: number | null }) =>
      `${f2(s.correctness)} / ${pc(s.correctRate)} / ${pc(s.completeness)}`;
    table.push(
      `| ${cat} | ${paired.n} | ${cell(stats.original as never)} | ${cell(stats['agent-prompt'] as never)} | ${cell(stats['rag-prompt'] as never)} | ${f2(paired.dCorrectness)}, ${paired.dCompleteness === null ? 'n/a' : `${(paired.dCompleteness * 100).toFixed(1)} pts`}, ${paired.ragBetter} / ${paired.tie} / ${paired.ragWorse} |`,
    );
  }
  const o = summary.overall as Record<string, { citationValid: number | null; citationsPerAnswer: number | null; utilization: number | null }>;
  const md = [
    `# Answer-prompt ablation on ${label}`,
    '',
    `- Run: \`${runId}\`, rows: ${rows.length} (errors excluded), judge: ${useJudge ? 'gpt-4o' : 'off'}`,
    `- Evidence held constant: each row's saved evidence rebuilt from the snapshot; the answer model saw the same evidence items (the agent's answer evidence) in both arms.`,
    `- Reconstruction check: ${reconstructionMismatches} of the baseline's citations did not match the rebuilt evidence text.`,
    `- "Original" is the baseline's own answer and judge verdict (same agent prompt, earlier sample): the gap between it and the agent-prompt arm is sampling noise.`,
    '',
    ...table,
    '',
    `Citations: agent prompt ${o['agent-prompt'].citationsPerAnswer?.toFixed(2)}/answer, valid ${pc(o['agent-prompt'].citationValid)}, evidence utilization ${pc(o['agent-prompt'].utilization)}; RAG prompt ${o['rag-prompt'].citationsPerAnswer?.toFixed(2)}/answer, valid ${pc(o['rag-prompt'].citationValid)}, utilization ${pc(o['rag-prompt'].utilization)}.`,
    '',
    `Cost (answers + judge): $${results.reduce((s, r) => s + r.costUsd, 0).toFixed(3)}. Errors: ${results.filter((r) => r.error).length}.`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({ baseline: label, runId, reconstructionMismatches, summary }, null, 2));
  fs.writeFileSync(path.join(outDir, 'summary.md'), md);
  process.stdout.write(`\n${md}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err?.stack ?? err}\n`);
  process.exit(1);
});
