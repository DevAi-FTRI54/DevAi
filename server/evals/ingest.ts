// Ingests the pinned golden-set commit into the isolated eval collection.
// Usage: npm run eval:ingest [-- --reset] [--golden path/to/golden.json]
import { EVAL_COLLECTION, EVAL_TARGETS } from './lib/env.js';
import { QdrantClient } from '@qdrant/js-client-rest';
import { loadGolden, argValue, hasFlag } from './lib/golden.js';

const BATCH_SIZE = 50;
const CONCURRENT_BATCHES = 5;

async function main() {
  const golden = loadGolden(argValue('golden'));
  const { cloneRepo, generateUniqueRepoId } = await import(
    '../src/features/indexing/git.service.js'
  );
  const { TsmorphCodeLoader } = await import(
    '../src/features/indexing/loader.service.js'
  );
  const { chunkDocuments } = await import(
    '../src/features/indexing/chunk.service.js'
  );
  const { upsert, ensureQdrantIndexes } = await import(
    '../src/features/indexing/vector.service.js'
  );

  const repoId = generateUniqueRepoId(golden.repoUrl);
  if (repoId !== golden.repoId) {
    throw new Error(
      `repoId mismatch: golden says ${golden.repoId}, generateUniqueRepoId gives ${repoId}`,
    );
  }

  console.log(`Eval targets: ${EVAL_TARGETS}`);
  console.log(`Repo: ${golden.repoUrl} @ ${golden.sha}`);
  await ensureQdrantIndexes();

  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL!,
    apiKey: process.env.QDRANT_API_KEY,
  });
  const filter = { must: [{ key: 'metadata.repoId', match: { value: repoId } }] };
  const { count } = await qdrant.count(EVAL_COLLECTION, { filter, exact: true });

  if (count > 0) {
    if (!hasFlag('reset')) {
      console.error(
        `${count} points already exist for ${repoId} in ${EVAL_COLLECTION}. Re-run with --reset to delete and re-ingest.`,
      );
      process.exit(1);
    }
    console.log(`Deleting ${count} existing points for ${repoId}...`);
    await qdrant.delete(EVAL_COLLECTION, { filter, wait: true });
  }

  const { localRepoPath } = await cloneRepo(golden.repoUrl, golden.sha);
  console.log(`Clone: ${localRepoPath}`);

  const docs = await new TsmorphCodeLoader(localRepoPath, repoId).load();
  const chunked = (await chunkDocuments(docs)).map((doc) =>
    doc.pageContent.trim().length === 0
      ? { ...doc, pageContent: 'Empty file' }
      : doc,
  );
  console.log(`Loaded ${docs.length} docs, ${chunked.length} after chunking`);

  const batches = [];
  for (let i = 0; i < chunked.length; i += BATCH_SIZE) {
    batches.push(chunked.slice(i, i + BATCH_SIZE));
  }
  let done = 0;
  for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
    const group = batches.slice(i, i + CONCURRENT_BATCHES);
    await Promise.all(group.map((b) => upsert(b)));
    done += group.reduce((s, b) => s + b.length, 0);
    console.log(`Upserted ${done}/${chunked.length}`);
  }

  const after = await qdrant.count(EVAL_COLLECTION, { filter, exact: true });
  console.log(`Done. ${after.count} points for ${repoId} in ${EVAL_COLLECTION}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
