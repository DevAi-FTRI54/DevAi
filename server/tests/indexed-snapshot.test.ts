import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { Document } from '@langchain/core/documents';
import { tempDir, writeFiles } from './helpers/fixtures.js';
import { snapshotPath } from '../src/features/indexing/git.service.js';
import { TsmorphCodeLoader } from '../src/features/indexing/loader.service.js';
import { InMemoryCodeLoader } from '../src/features/indexing/memory-loader.service.js';
import { chunkDocuments } from '../src/features/indexing/chunk.service.js';
import {
  assembleCitations,
  buildEvidence,
  snapshotSourceRoot,
} from '../src/features/queries/evidence.js';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const REPO = 'github_com_acme_widgets';

before(() => {
  process.env.REPO_CACHE_DIR = tempDir('devai-cache-');
  // Loader progress logs share stdout with the test runner's result stream and can corrupt it.
  mock.method(console, 'log', () => {});
});

const doc = (pageContent: string, metadata: Record<string, unknown>) =>
  new Document({ pageContent, metadata: { repoId: REPO, filePath: 'src/a.ts', ...metadata } });

test('the ts-morph loader stamps commitSha on file and declaration documents, and chunks keep it', async () => {
  const root = tempDir('devai-repo-');
  const longBody = Array.from({ length: 400 }, (_, i) => `  const v${i} = ${i};`).join('\n');
  writeFiles(root, {
    'src/a.ts': `export function small() {\n  return 1;\n}\n\nexport function big() {\n${longBody}\n}\n`,
  });

  const docs = await new TsmorphCodeLoader(root, REPO, SHA_A).load();
  assert.ok(docs.length >= 3);
  for (const d of docs) assert.equal(d.metadata.commitSha, SHA_A);

  const chunks = await chunkDocuments(docs);
  assert.ok(chunks.some((c) => c.metadata.chunked));
  for (const c of chunks) assert.equal(c.metadata.commitSha, SHA_A);
});

test('the ts-morph loader omits commitSha when none is given', async () => {
  const root = tempDir('devai-repo-');
  writeFiles(root, { 'a.ts': 'export const a = 1;\n' });
  const docs = await new TsmorphCodeLoader(root, REPO).load();
  for (const d of docs) assert.equal('commitSha' in d.metadata, false);
});

test('the in-memory loader stamps commitSha on every document', async () => {
  const docs = await new InMemoryCodeLoader(
    [{ path: 'src/a.ts', content: 'export class A {\n  m() {}\n}\n', sha: 'f'.repeat(40), size: 30, type: 'file' }],
    REPO,
    'widgets',
    SHA_B,
  ).load();
  assert.ok(docs.length >= 2);
  for (const d of docs) assert.equal(d.metadata.commitSha, SHA_B);
});

test('buildEvidence carries the commit, the semanticSearch source and the declaration name', () => {
  const [withSha, legacy] = buildEvidence(
    [
      doc('export function f() {}\n', { commitSha: SHA_A, startLine: 3, declarationName: 'f' }),
      doc('const x = 1;\n', { startLine: 1 }),
    ],
    REPO,
  );
  assert.equal(withSha.commitSha, SHA_A);
  assert.equal(withSha.source, 'semanticSearch');
  assert.equal(withSha.label, 'f');
  assert.equal(legacy.commitSha, null);
  assert.equal(legacy.source, 'semanticSearch');
  assert.equal(legacy.label, undefined);
});

test('citations are copied from the indexed commit even when several snapshots are cached', () => {
  writeFiles(snapshotPath(REPO, SHA_A), { 'src/a.ts': 'line1\n  alphaA\nline3\n' });
  writeFiles(snapshotPath(REPO, SHA_B), { 'src/a.ts': 'line1\n  alphaB\nline3\n' });

  const evidence = buildEvidence(
    [doc('line1\nalphaA\nline3\n', { commitSha: SHA_A, startLine: 1 })],
    REPO,
  );
  const { citations, diagnostics } = assembleCitations(
    [{ evidenceId: 'E1', startLine: 2, endLine: 2 }],
    evidence,
    snapshotSourceRoot,
  );
  assert.equal(diagnostics.emitted, 1);
  assert.equal(citations[0].snippet, '  alphaA');

  const fromB = assembleCitations(
    [{ evidenceId: 'E1', startLine: 2, endLine: 2 }],
    buildEvidence([doc('line1\nalphaB\nline3\n', { commitSha: SHA_B, startLine: 1 })], REPO),
    snapshotSourceRoot,
  );
  assert.equal(fromB.citations[0].snippet, '  alphaB');
});

test('legacy evidence without a commit ignores ambiguous caches and uses the indexed text', () => {
  const evidence = buildEvidence([doc('line1\nalphaLegacy\nline3\n', { startLine: 1 })], REPO);
  assert.equal(snapshotSourceRoot(evidence[0]), null);
  const { citations } = assembleCitations(
    [{ evidenceId: 'E1', startLine: 2, endLine: 2 }],
    evidence,
    snapshotSourceRoot,
  );
  assert.equal(citations[0].snippet, 'alphaLegacy');
});

test('legacy evidence uses the cached clone when it is the only one', () => {
  const repo = 'github_com_acme_single';
  writeFiles(snapshotPath(repo, SHA_A), { 'src/a.ts': 'x\n    indented\n' });
  fs.mkdirSync(path.join(path.dirname(snapshotPath(repo, SHA_A)), '.tmp-inflight'));
  const ev = { repoId: repo, commitSha: null };
  assert.equal(snapshotSourceRoot(ev), snapshotPath(repo, SHA_A));
});

test('evidence whose commit snapshot is not cached falls back to the indexed text', () => {
  const sha = 'c'.repeat(40);
  const evidence = buildEvidence([doc('one\ntwo\n', { commitSha: sha, startLine: 1 })], REPO);
  assert.equal(snapshotSourceRoot(evidence[0]), null);
  const { citations, diagnostics } = assembleCitations(
    [{ evidenceId: 'E1', startLine: 2, endLine: 2 }],
    evidence,
    snapshotSourceRoot,
  );
  assert.equal(diagnostics.missingFile, 0);
  assert.equal(citations[0].snippet, 'two');
});

test('a file missing from the indexed snapshot is reported, not read from another commit', () => {
  const evidence = buildEvidence(
    [
      new Document({
        pageContent: 'gone\n',
        metadata: { repoId: REPO, commitSha: SHA_A, filePath: 'src/deleted.ts', startLine: 1 },
      }),
    ],
    REPO,
  );
  const { citations, diagnostics } = assembleCitations(
    [{ evidenceId: 'E1', startLine: 1, endLine: 1 }],
    evidence,
    snapshotSourceRoot,
  );
  assert.equal(citations.length, 0);
  assert.equal(diagnostics.missingFile, 1);
});
