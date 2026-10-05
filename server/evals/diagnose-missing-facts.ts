// Diagnostic: for every key fact in a RAG baseline, asks whether the retrieved context contained the code needed
// to state it ("present" / "partial" / "absent"), blind to whether the answer covered it. Facts the judge marked
// missed and the classifier marked present were lost in generation; absent ones were lost in retrieval.
// Usage: npx tsx evals/diagnose-missing-facts.ts [--baseline rag-v2.1] [--out .cache/missing-facts-diagnosis.json]
// Context text is rebuilt from the pinned snapshot by file and line range. Verdicts are cached per unique context
// in <out>.cache.json, so an interrupted run resumes without repeating calls.
import './lib/env.js';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { loadGolden, argValue, EVALS_DIR, type GoldenItem } from './lib/golden.js';
import { clonePath } from './lib/repoFiles.js';
import { TokenUsageHandler, chatCost } from './lib/tokens.js';
import type { ContextDoc } from './lib/metrics.js';

const MODEL = process.env.EVAL_JUDGE_MODEL ?? 'gpt-4o';

type BaselineRow = {
  id: string;
  category: string;
  repeat: number;
  error: string | null;
  context: ContextDoc[];
  retrieval: { missingRequiredFiles?: string[] } | null;
  judge: { facts: { covered: boolean }[] } | null;
};
type Verdict = { fact: string; verdict: 'present' | 'partial' | 'absent'; quote: string };

const schema = z.object({
  facts: z.array(z.object({ index: z.number().int(), verdict: z.enum(['present', 'partial', 'absent']), quote: z.string() })),
});

const SYSTEM = `You audit a retrieval system. You receive a question, numbered reference facts about a codebase, and the code chunks the retriever returned.

For EACH fact, decide whether the retrieved chunks contain the code needed to state that fact:
- "present": a reader of only these chunks could state the fact accurately.
- "partial": the chunks support part of the fact, or only hint at it (e.g. a call site without the behavior, or one of two named things).
- "absent": the chunks do not contain the needed code.
Judge only against the chunks shown, not general knowledge. Put a short supporting quote (file and code) in "quote", or an empty string if absent. Return exactly one entry per fact, in order, with "index" equal to the fact number.`;

const llm = new ChatOpenAI({ model: MODEL, temperature: 0, maxRetries: 2 }).withStructuredOutput(schema, {
  method: 'jsonSchema',
  strict: true,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const golden = loadGolden(argValue('golden'));
  const label = argValue('baseline') ?? 'rag-v2.1';
  const out = argValue('out') ?? '.cache/missing-facts-diagnosis.json';
  const cachePath = `${out}.cache.json`;
  const baseline: { results: BaselineRow[] } = JSON.parse(
    fs.readFileSync(path.join(EVALS_DIR, 'baselines', `${label}-${golden.sha.slice(0, 7)}.json`), 'utf8'),
  );
  const items = new Map<string, GoldenItem>(golden.items.map((i) => [i.id, i]));
  const root = clonePath(golden.repoId, golden.sha);
  const readLines = (file: string, s: number, e: number) =>
    fs.readFileSync(path.join(root, file), 'utf8').split('\n').slice(s - 1, e).join('\n');
  const ctxKey = (r: BaselineRow) => `${r.id}|${r.context.map((c) => `${c.filePath}:${c.startLine}-${c.endLine}`).join(',')}`;

  const rows = baseline.results.filter((r) => !r.error && r.judge);
  const unique = new Map<string, BaselineRow>();
  for (const r of rows) if (!unique.has(ctxKey(r))) unique.set(ctxKey(r), r);
  const verdicts = new Map<string, Verdict[]>(
    fs.existsSync(cachePath) ? Object.entries(JSON.parse(fs.readFileSync(cachePath, 'utf8'))) : [],
  );
  const usage = new TokenUsageHandler();

  const classify = async (key: string, r: BaselineRow) => {
    const item = items.get(r.id)!;
    const facts = item.key_facts.map((f, i) => `${i + 1}. ${f}`).join('\n');
    const chunks = r.context
      .map((c, i) => `[chunk ${i + 1}] ${c.filePath} lines ${c.startLine}-${c.endLine}\n${readLines(c.filePath, c.startLine, c.endLine)}`)
      .join('\n\n');
    const res = await llm.invoke(
      [
        ['system', SYSTEM],
        ['user', `QUESTION:\n${item.question}\n\nREFERENCE FACTS:\n${facts}\n\nRETRIEVED CHUNKS:\n${chunks}`],
      ],
      { callbacks: [usage] },
    );
    const byIndex = new Map(res.facts.map((f) => [f.index, f]));
    verdicts.set(
      key,
      item.key_facts.map((fact, i) => {
        const v = byIndex.get(i + 1);
        return { fact, verdict: v?.verdict ?? 'absent', quote: v?.quote ?? '' };
      }),
    );
  };

  // gpt-4o's tokens-per-minute limit is the constraint here, so run two at a time and back off on 429s.
  const queue = [...unique.entries()].filter(([k]) => !verdicts.has(k));
  process.stdout.write(`${unique.size} unique contexts, ${queue.length} to classify with ${MODEL}\n`);
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (queue.length) {
        const [key, r] = queue.shift()!;
        for (let attempt = 1; ; attempt++) {
          try {
            await classify(key, r);
            fs.writeFileSync(cachePath, JSON.stringify(Object.fromEntries(verdicts)));
            break;
          } catch (err) {
            const msg = String((err as Error)?.message ?? err);
            if (attempt >= 6 || !/429|rate limit/i.test(msg)) {
              process.stderr.write(`classify failed for ${r.id}: ${msg.split('\n')[0]}\n`);
              break;
            }
            await sleep(15000 * attempt);
          }
        }
      }
    }),
  );

  // Import graph over the snapshot (relative imports only), to see whether missed files are one hop away.
  const importCache = new Map<string, Set<string>>();
  const importsOf = (file: string) => {
    if (importCache.has(file)) return importCache.get(file)!;
    const found = new Set<string>();
    const abs = path.join(root, file);
    const src = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
    for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"](\.[^'"]+)['"]/g)) {
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])).replace(/\.(js|jsx|ts|tsx)$/, '');
      const hit = [`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}/index.ts`, `${base}/index.tsx`].find((c) =>
        fs.existsSync(path.join(root, c)),
      );
      if (hit) found.add(hit);
    }
    importCache.set(file, found);
    return found;
  };

  const factRows: { id: string; category: string; repeat: number; fact: string; covered: boolean | null; verdict: string; quote: string }[] = [];
  const oneHop: { id: string; repeat: number; file: string; reachable: boolean }[] = [];
  for (const r of rows) {
    const v = verdicts.get(ctxKey(r));
    if (!v) continue;
    v.forEach((fv, i) => factRows.push({ id: r.id, category: r.category, repeat: r.repeat, covered: r.judge!.facts[i]?.covered ?? null, ...fv }));
    const retrieved = [...new Set(r.context.map((c) => c.filePath))];
    for (const f of r.retrieval?.missingRequiredFiles ?? []) {
      oneHop.push({ id: r.id, repeat: r.repeat, file: f, reachable: retrieved.some((rf) => importsOf(rf).has(f) || importsOf(f).has(rf)) });
    }
  }

  const pct = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(0)}%` : '-');
  const fmt = (list: typeof factRows) => {
    const c = { present: 0, partial: 0, absent: 0 } as Record<string, number>;
    for (const x of list) c[x.verdict]++;
    return `n=${list.length} present=${c.present} (${pct(c.present, list.length)}) partial=${c.partial} (${pct(c.partial, list.length)}) absent=${c.absent} (${pct(c.absent, list.length)})`;
  };
  const missed = factRows.filter((x) => x.covered === false);
  const lines = [
    `model=${MODEL} uniqueContexts=${unique.size} classified=${verdicts.size} cost this run=$${chatCost(usage.usage).toFixed(3)}`,
    `Missed facts (judge: not covered): ${fmt(missed)}`,
    `Covered facts (sanity check):      ${fmt(factRows.filter((x) => x.covered === true))}`,
    'Missed facts by category:',
    ...[...new Set(factRows.map((x) => x.category))].sort().map((cat) => `  ${cat.padEnd(20)} ${fmt(missed.filter((x) => x.category === cat))}`),
    `Required files missed by retrieval: ${oneHop.length}; one import hop from a retrieved file: ${oneHop.filter((x) => x.reachable).length} (${pct(oneHop.filter((x) => x.reachable).length, oneHop.length)})`,
  ];
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ baseline: label, model: MODEL, rows: factRows, oneHop }, null, 1));
  process.stdout.write(`${lines.join('\n')}\nwrote ${out}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err?.stack ?? err}\n`);
  process.exit(1);
});
