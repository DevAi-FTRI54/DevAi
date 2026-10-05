import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Document } from '@langchain/core/documents';
import {
  rankDocuments,
  rerankDocuments,
  installRerankCache,
  uninstallRerankCache,
  setRerankScorer,
  rerankStats,
} from '../src/features/queries/rerank.js';

const doc = (filePath: string, startLine: number, content: string) =>
  new Document({ pageContent: content, metadata: { filePath, startLine, endLine: startLine + 1 } });

afterEach(() => {
  setRerankScorer(null);
  uninstallRerankCache();
});

test('ranks by score and only sends uncached pairs to the scorer', async () => {
  const sent: string[][] = [];
  setRerankScorer(async (_q, docs) => {
    sent.push(docs.map((d) => d.pageContent));
    return docs.map((d) => Number(d.pageContent.length));
  });
  installRerankCache(null);
  const a = doc('a.ts', 1, 'x');
  const b = doc('b.ts', 1, 'xxx');
  const c = doc('c.ts', 1, 'xx');

  assert.deepEqual((await rerankDocuments([a, b], 'q', 5)).map((d) => d.pageContent), ['xxx', 'x']);
  assert.deepEqual((await rerankDocuments([a, b, c], 'q', 2)).map((d) => d.pageContent), ['xxx', 'xx']);
  assert.deepEqual(sent, [['x', 'xxx'], ['xx']]);

  // Same documents, different query: not cached.
  await rankDocuments([a], 'other');
  assert.equal(sent.length, 3);
});

test('without a cache every call is sent; failures are counted and rethrown', async () => {
  let calls = 0;
  setRerankScorer(async (_q, docs) => {
    calls++;
    return docs.map(() => 1);
  });
  await rankDocuments([doc('a.ts', 1, 'x')], 'q');
  await rankDocuments([doc('a.ts', 1, 'x')], 'q');
  assert.equal(calls, 2);

  const failuresBefore = rerankStats.failures;
  setRerankScorer(async () => {
    throw new Error('402');
  });
  await assert.rejects(rankDocuments([doc('a.ts', 1, 'x')], 'q'), /402/);
  assert.equal(rerankStats.failures, failuresBefore + 1);
});

test('ties keep input order', async () => {
  setRerankScorer(async (_q, docs) => docs.map(() => 0.5));
  const docs = [doc('a.ts', 1, 'a'), doc('b.ts', 1, 'b'), doc('c.ts', 1, 'c')];
  assert.deepEqual((await rerankDocuments(docs, 'q', 3)).map((d) => d.pageContent), ['a', 'b', 'c']);
});
