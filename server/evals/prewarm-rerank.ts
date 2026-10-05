// Scores every indexed chunk against every golden question once (one Cohere call per question) and stores
// the scores in the eval rerank cache, so later eval runs of RAG make no rerank API calls.
// Usage: npx tsx evals/prewarm-rerank.ts [--only E01,X05] [--verify 3]
// --verify N re-ranks N real v2.1 candidate pools live (cache bypassed) and checks the cached order matches.
import { EVAL_TARGETS, EVAL_COLLECTION } from './lib/env.js';
import { Document } from '@langchain/core/documents';
import { QdrantClient } from '@qdrant/js-client-rest';
import { loadGolden, argValue } from './lib/golden.js';
import { preflightRerank, RERANK_CACHE_FILE } from './lib/rerank.js';
import { cohereApiKey } from '../src/config/cohere.js';
import {
  cohereScorer,
  installRerankCache,
  rankDocuments,
  rerankStats,
  setRerankScorer,
  uninstallRerankCache,
} from '../src/features/queries/rerank.js';

// Trial keys allow ~10 rerank calls a minute.
let nextCallAt = 0;
const throttle = async () => {
  const wait = nextCallAt - Date.now();
  nextCallAt = Math.max(Date.now(), nextCallAt) + 6500;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
};

async function main() {
  const golden = loadGolden(argValue('golden'));
  const only = argValue('only')?.split(',').map((s) => s.trim());
  const verify = Number(argValue('verify') ?? 0);
  const items = golden.items.filter((i) => !only || only.includes(i.id));
  const problem = await preflightRerank(cohereApiKey());
  if (problem) throw new Error(`Reranker unavailable (${problem})`);

  const qdrant = new QdrantClient({ url: process.env.QDRANT_URL!, apiKey: process.env.QDRANT_API_KEY || undefined, checkCompatibility: false });
  const chunks: Document[] = [];
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
      chunks.push(new Document({ pageContent: payload.content, metadata: payload.metadata }));
    }
    offset = page.next_page_offset as string | number | null | undefined;
  } while (offset != null);
  process.stdout.write(`Eval targets: ${EVAL_TARGETS}\n${chunks.length} chunks, ${items.length} questions, cache ${RERANK_CACHE_FILE}\n`);

  setRerankScorer(async (query, docs) => {
    await throttle();
    return cohereScorer(query, docs);
  });
  installRerankCache(RERANK_CACHE_FILE);
  for (const item of items) {
    const before = rerankStats.apiCalls;
    await rankDocuments(chunks, item.question);
    process.stdout.write(`${item.id} ${rerankStats.apiCalls > before ? 'scored' : 'cached'}\n`);
  }
  process.stdout.write(`Prewarm: ${rerankStats.apiCalls} API calls, ${rerankStats.newScores} new scores, ${rerankStats.cachedScores} already cached.\n`);

  if (verify > 0) {
    const { createCodeRetriever } = await import('../src/features/indexing/vector.service.js');
    let mismatches = 0;
    for (const item of items.slice(0, verify)) {
      const pool = await (await createCodeRetriever(golden.repoId, 8)).invoke(item.question);
      installRerankCache(RERANK_CACHE_FILE);
      const cached = (await rankDocuments(pool, item.question)).map((r) => r.doc);
      uninstallRerankCache();
      const live = (await rankDocuments(pool, item.question)).map((r) => r.doc);
      const key = (d: Document) => `${d.metadata.filePath}:${d.metadata.startLine}`;
      const same5 = cached.slice(0, 5).map(key).join() === live.slice(0, 5).map(key).join();
      const same8 = cached.slice(0, 8).map(key).join() === live.slice(0, 8).map(key).join();
      if (!same5 || !same8) mismatches++;
      process.stdout.write(`verify ${item.id}: pool ${pool.length}, top-5 order ${same5 ? 'matches' : 'DIFFERS'}, top-8 order ${same8 ? 'matches' : 'DIFFERS'}\n`);
    }
    process.stdout.write(`Verify: ${mismatches} of ${Math.min(verify, items.length)} pools differ. Total API calls this run: ${rerankStats.apiCalls}.\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`${err?.stack ?? err}\n`);
  process.exit(1);
});
