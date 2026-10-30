// Diagnostic: retrieval only (no generation, no judge). For each golden question, runs the v2.1 retriever
// (multi-query MMR pool), reranks the whole pool with Cohere to get a full order, and measures how often the
// expected source ranges reach the context under different context sizes and pool expansions:
//   base        v2.1 pool, top N by rerank (N=5 is v2.1)
//   +file       pool plus every other chunk from the top-5 files, reranked
//   +imports    pool plus every chunk from files one relative-import hop from the top-5 files, reranked
//   +both       both expansions
//   whole index every indexed chunk reranked, no vector search (an upper bound for reranking alone)
//   reachable   any variant with chunks from files unreachable from the app entry points removed first
// One rerank call per question: Cohere scores documents independently, so every variant's order is a filter
// of a single ranking over the pool plus the whole index.
// Usage: npx tsx evals/retrieval-pool.ts [--repeats 2] [--only E01,X05] [--concurrency 3]
import { EVAL_TARGETS, EVAL_COLLECTION } from './lib/env.js';
import fs from 'fs';
import path from 'path';
import { Document } from '@langchain/core/documents';
import { CohereRerank } from '@langchain/cohere';
import { QdrantClient } from '@qdrant/js-client-rest';
import { loadGolden, argValue, EVALS_DIR, type GoldenItem } from './lib/golden.js';
import { clonePath } from './lib/repoFiles.js';
import { toContextDoc, retrievalMetrics, mean } from './lib/metrics.js';
import { preflightRerank } from './lib/rerank.js';
import { cohereApiKey } from '../src/config/cohere.js';

const NS = [5, 8, 10] as const;
const ENTRY_POINTS = ['server/src/server.ts', 'client/src/main.tsx'];

const docKey = (d: Document) => `${d.metadata.filePath}:${d.metadata.startLine}-${d.metadata.endLine}`;
const dedupe = (docs: Document[]) => [...new Map(docs.map((d) => [docKey(d), d])).values()];

async function main() {
  const golden = loadGolden(argValue('golden'));
  const repeats = Number(argValue('repeats') ?? 2);
  const only = argValue('only')?.split(',').map((s) => s.trim());
  const concurrency = Math.max(1, Number(argValue('concurrency') ?? 3));
  const items = golden.items.filter((i) => !only || only.includes(i.id));
  const root = clonePath(golden.repoId, golden.sha);
  const { createCodeRetriever } = await import('../src/features/indexing/vector.service.js');

  // --- Every indexed chunk for the repo, grouped by file ------------------------------------
  const qdrant = new QdrantClient({ url: process.env.QDRANT_URL!, apiKey: process.env.QDRANT_API_KEY || undefined, checkCompatibility: false });
  const allChunks: Document[] = [];
  let offset: string | number | null | undefined;
  do {
    const page = await qdrant.scroll(EVAL_COLLECTION, {
      filter: { must: [{ key: 'metadata.repoId', match: { value: golden.repoId } }] },
      with_payload: true,
      with_vector: false,
      limit: 256,
      ...(offset != null && { offset }),
    });
    for (const p of page.points) {
      const payload = p.payload as { content: string; metadata: Record<string, unknown> };
      allChunks.push(new Document({ pageContent: payload.content, metadata: payload.metadata }));
    }
    offset = page.next_page_offset as string | number | null | undefined;
  } while (offset != null);
  const byFile = new Map<string, Document[]>();
  for (const d of allChunks) {
    const f = String(d.metadata.filePath);
    if (!byFile.has(f)) byFile.set(f, []);
    byFile.get(f)!.push(d);
  }
  const indexedFiles = [...byFile.keys()];

  // --- Import graph over indexed files (relative static and dynamic imports) ------------------
  const imports = new Map<string, Set<string>>();
  for (const file of indexedFiles) {
    const found = new Set<string>();
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"](\.[^'"]+)['"]/g)) {
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])).replace(/\.(js|jsx|ts|tsx)$/, '');
      const hit = [`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}/index.ts`, `${base}/index.tsx`].find((c) => byFile.has(c));
      if (hit) found.add(hit);
    }
    imports.set(file, found);
  }
  const importedBy = new Map<string, Set<string>>();
  for (const [from, tos] of imports) for (const to of tos) (importedBy.get(to) ?? importedBy.set(to, new Set()).get(to)!).add(from);
  const neighbors = (file: string) => new Set([...(imports.get(file) ?? []), ...(importedBy.get(file) ?? [])]);

  // Reachable = transitively imported from an app entry point; files outside src/ (build/tool config) count as roots.
  const reachable = new Set<string>();
  const stack = [...ENTRY_POINTS, ...indexedFiles.filter((f) => !/\/src\//.test(f))].filter((f) => byFile.has(f));
  while (stack.length) {
    const f = stack.pop()!;
    if (reachable.has(f)) continue;
    reachable.add(f);
    for (const t of imports.get(f) ?? []) stack.push(t);
  }
  const unreachable = indexedFiles.filter((f) => !reachable.has(f)).sort();
  const expectedUnreachable = [...new Set(golden.items.flatMap((i) => i.expected_sources.map((s) => s.file)))].filter((f) => byFile.has(f) && !reachable.has(f));

  process.stdout.write(
    `Eval targets: ${EVAL_TARGETS}\n${allChunks.length} chunks in ${indexedFiles.length} files; ${unreachable.length} files unreachable from ${ENTRY_POINTS.join(', ')}:\n  ${unreachable.join('\n  ')}\nExpected sources that are unreachable: ${expectedUnreachable.length ? expectedUnreachable.join(', ') : 'none'}\n\n`,
  );

  const rerankProblem = await preflightRerank(cohereApiKey());
  if (rerankProblem) throw new Error(`Reranker unavailable (${rerankProblem}); this experiment needs it.`);
  const reranker = new CohereRerank({ apiKey: cohereApiKey(), model: 'rerank-v3.5', topN: 100 });
  // Trial keys allow ~10 rerank calls a minute.
  let nextCallAt = 0;
  const throttle = async () => {
    const wait = nextCallAt - Date.now();
    nextCallAt = Math.max(Date.now(), nextCallAt) + 6500;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  };
  let rerankCalls = 0;
  const rerankAll = async (docs: Document[], q: string) => {
    if (!docs.length) return [];
    for (let attempt = 0; ; attempt++) {
      await throttle();
      rerankCalls++;
      try {
        const ranks = await reranker.rerank(docs, q, { topN: docs.length });
        return ranks.map((r: { index: number }) => docs[r.index]);
      } catch (err) {
        if (attempt >= 5) throw err;
        await new Promise((r) => setTimeout(r, 3000 * 2 ** attempt));
      }
    }
  };

  type Variant = 'base' | '+file' | '+imports' | '+both' | 'whole index';
  const VARIANTS: Variant[] = ['base', '+file', '+imports', '+both', 'whole index'];
  type Row = { id: string; category: string; repeat: number; poolSize: number; metrics: Record<string, Record<number, { req: number; all: number; file: number; chars: number; decoys: number }>> };
  const rows: Row[] = [];

  const rangeRecallAll = (item: GoldenItem, docs: Document[]) => {
    const ctx = docs.map(toContextDoc);
    const withLines = item.expected_sources.filter((s) => s.lines);
    const hit = withLines.filter((s) => retrievalMetrics({ ...item, expected_sources: [{ ...s, required: true }] }, ctx).requiredRangeRecall === 1);
    return withLines.length ? hit.length / withLines.length : 0;
  };

  const runOne = async (item: GoldenItem, repeat: number) => {
    const retriever = await createCodeRetriever(golden.repoId, 8);
    const pool = dedupe(await retriever.invoke(item.question));
    const poolKeys = new Set(pool.map(docKey));
    // Cohere scores each document against the query independently, so one ranking of the largest pool gives
    // every variant's order by filtering. The expansion targets come from the base top 5, which is the same
    // filter applied to a ranking of the base pool plus every indexed chunk.
    const everything = await rerankAll(dedupe([...pool, ...allChunks]), item.question);
    const baseRanked = everything.filter((d) => poolKeys.has(docKey(d)));
    const topFiles = [...new Set(baseRanked.slice(0, 5).map((d) => String(d.metadata.filePath)))];
    const fileExtra = topFiles.flatMap((f) => byFile.get(f) ?? []);
    const importExtra = [...new Set(topFiles.flatMap((f) => [...neighbors(f)]))].flatMap((f) => byFile.get(f) ?? []);
    const pools: Record<Variant, Document[]> = {
      base: pool,
      '+file': dedupe([...pool, ...fileExtra]),
      '+imports': dedupe([...pool, ...importExtra]),
      '+both': dedupe([...pool, ...fileExtra, ...importExtra]),
      'whole index': everything,
    };
    const metrics: Row['metrics'] = {};
    for (const v of VARIANTS) {
      const keys = new Set(pools[v].map(docKey));
      const ranked = everything.filter((d) => keys.has(docKey(d)));
      for (const [name, list] of [
        [v, ranked],
        [`${v} reachable`, ranked.filter((d) => reachable.has(String(d.metadata.filePath)))],
      ] as const) {
        metrics[name] = {};
        for (const n of NS) {
          const top = list.slice(0, n);
          const m = retrievalMetrics(item, top.map(toContextDoc));
          metrics[name][n] = {
            req: m.requiredRangeRecall,
            all: rangeRecallAll(item, top),
            file: m.fileRecall,
            chars: top.reduce((s, d) => s + d.pageContent.length, 0),
            decoys: top.filter((d) => !reachable.has(String(d.metadata.filePath))).length,
          };
        }
      }
    }
    const row = { id: item.id, category: item.category, repeat, poolSize: pool.length, metrics };
    rows.push(row);
    process.stdout.write(
      `${item.id}#${repeat} pool=${pool.length} req@5 base=${metrics.base[5].req.toFixed(2)} base@8=${metrics.base[8].req.toFixed(2)} +both@8=${metrics['+both'][8].req.toFixed(2)} +both reachable@8=${metrics['+both reachable'][8].req.toFixed(2)}\n`,
    );
  };

  const jobs = items.flatMap((item) => Array.from({ length: repeats }, (_, r) => [item, r] as const));
  let cursor = 0;
  const silence = console.log;
  console.log = () => {};
  try {
    await Promise.all(
      Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
        while (cursor < jobs.length) {
          const [item, r] = jobs[cursor++];
          try {
            await runOne(item, r);
          } catch (err) {
            process.stderr.write(`${item.id}#${r} failed: ${String((err as Error)?.message ?? err).split('\n')[0]}\n`);
          }
        }
      }),
    );
  } finally {
    console.log = silence;
  }

  // --- Summary ----------------------------------------------------------------------------------
  const names = VARIANTS.flatMap((v) => [v, `${v} reachable`]);
  const pc = (x: number | null) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
  const cats = ['overall', ...[...new Set(rows.map((r) => r.category))].sort()];
  const md: string[] = [
    `# Retrieval pool experiment (${rows.length} runs = ${items.length} questions × ${repeats})`,
    '',
    `Mean v2.1 pool size: ${mean(rows.map((r) => r.poolSize))?.toFixed(1)} chunks. Unreachable files: ${unreachable.length}. Rerank calls: ${rerankCalls}.`,
    '',
    '## Overall',
    '',
    '| Variant | N | Required range recall | All-source range recall | Required file recall | Context chars | Unreachable chunks in context |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const name of names) {
    for (const n of NS) {
      const ms = rows.map((r) => r.metrics[name][n]);
      md.push(
        `| ${name} | ${n} | ${pc(mean(ms.map((m) => m.req)))} | ${pc(mean(ms.map((m) => m.all)))} | ${pc(mean(ms.map((m) => m.file)))} | ${mean(ms.map((m) => m.chars))?.toFixed(0)} | ${mean(ms.map((m) => m.decoys))?.toFixed(2)} |`,
      );
    }
  }
  md.push('', '## All-source range recall by category', '', `| Category | ${names.flatMap((nm) => [`${nm} @5`, `${nm} @8`]).join(' | ')} |`, `|---|${names.flatMap(() => ['---', '---']).join('|')}|`);
  for (const cat of cats) {
    const rs = rows.filter((r) => cat === 'overall' || r.category === cat);
    md.push(`| ${cat} (${rs.length}) | ${names.flatMap((nm) => [5, 8].map((n) => pc(mean(rs.map((r) => r.metrics[nm][n].all))))).join(' | ')} |`);
  }
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(EVALS_DIR, 'results', `${runId}_retrieval-pool`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ unreachable, rows }, null, 1));
  fs.writeFileSync(path.join(outDir, 'summary.md'), md.join('\n') + '\n');
  process.stdout.write(`\n${md.join('\n')}\n\nwrote ${path.relative(process.cwd(), outDir)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err?.stack ?? err}\n`);
  process.exit(1);
});
