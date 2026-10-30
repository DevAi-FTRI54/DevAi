import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Document } from '@langchain/core/documents';
import { tempDir, writeFiles } from './helpers/fixtures.js';
import { RepoSnapshot } from '../src/features/tools/snapshot.js';
import { semanticSearch, type SemanticRetriever } from '../src/features/tools/semantic-search.js';
import { EvidenceStore } from '../src/features/tools/evidence-store.js';
import { ToolError } from '../src/features/tools/types.js';

const REPO = 'acme_widgets';
const SHA = 'ef'.repeat(20);
const OTHER_SHA = '01'.repeat(20);

const root = tempDir('devai-snap-');
writeFiles(root, {
  'src/auth.ts': [
    '/** Verifies a token. */', //          1
    'export function verify(t: string) {', // 2
    '  return t.length > 0;', //             3
    '}', //                                   4
    '', //                                    5
    'export const x = 1;', //                6
  ].join('\n') + '\n',
});
const snap = new RepoSnapshot(REPO, SHA, root);

const doc = (pageContent: string, metadata: Record<string, unknown>) =>
  new Document({ pageContent, metadata: { repoId: REPO, filePath: 'src/auth.ts', ...metadata } });

const fixed = (docs: Document[]): SemanticRetriever => async () => docs;

test('passes the query and snapshot repoId to the retriever', async () => {
  const calls: Array<[string, string]> = [];
  await semanticSearch(snap, { query: 'how are tokens verified?' }, async (q, repoId) => {
    calls.push([q, repoId]);
    return [];
  });
  assert.deepEqual(calls, [['how are tokens verified?', REPO]]);
});

test('keeps rerank order and re-reads exact lines from the snapshot', async () => {
  const result = await semanticSearch(
    snap,
    { query: 'verify' },
    fixed([
      doc('export const x = 1;', { commitSha: SHA, startLine: 6, endLine: 6 }),
      // Declaration text starts at its leading JSDoc and has lost indentation, as indexed text can.
      doc('/** Verifies a token. */\nexport function verify(t: string) {\nreturn t.length > 0;\n}', {
        commitSha: SHA,
        startLine: 2,
        textStartLine: 1,
        declarationName: 'verify',
      }),
    ]),
  );
  assert.equal(result.tool, 'semanticSearch');
  assert.deepEqual(
    result.evidence.map((e) => [e.filePath, e.startLine, e.endLine, e.label]),
    [
      ['src/auth.ts', 6, 6, undefined],
      ['src/auth.ts', 1, 4, 'verify'],
    ],
  );
  assert.equal(result.evidence[1].content.split('\n')[2], '  return t.length > 0;');
  for (const e of result.evidence) {
    assert.equal(e.source, 'semanticSearch');
    assert.equal(e.commitSha, SHA);
  }
  assert.equal(result.note, '2 of 2 retrieved chunks.');
});

test('drops chunks indexed from another commit or missing from the snapshot', async () => {
  const result = await semanticSearch(
    snap,
    { query: 'verify' },
    fixed([
      doc('export const x = 1;', { commitSha: OTHER_SHA, startLine: 6 }),
      doc('gone', { commitSha: SHA, filePath: 'src/deleted.ts', startLine: 1 }),
      doc('export const x = 1;', { repoId: 'someone_else', commitSha: SHA, startLine: 6 }),
      doc('export const x = 1;', { commitSha: SHA, startLine: 6 }),
    ]),
  );
  assert.deepEqual(result.evidence.map((e) => e.startLine), [6]);
  assert.equal(
    result.note,
    '1 of 4 retrieved chunks; 2 from another commit dropped; 1 not in snapshot dropped.',
  );
});

test('legacy chunks without a commit are kept only when their text matches the snapshot', async () => {
  const result = await semanticSearch(
    snap,
    { query: 'verify' },
    fixed([
      doc('export  const x = 1;', { startLine: 6 }),
      doc('export const x = 2;', { startLine: 6, chunked: true }),
    ]),
  );
  assert.deepEqual(result.evidence.map((e) => [e.startLine, e.content]), [[6, 'export const x = 1;']]);
  assert.equal(result.note, '1 of 2 retrieved chunks; 1 unverifiable legacy chunks dropped.');
});

test('k limits results, duplicates collapse, and ordering is stable', async () => {
  const docs = [
    doc('export const x = 1;', { commitSha: SHA, startLine: 6 }),
    doc('export const x = 1;', { commitSha: SHA, startLine: 6 }),
    doc('/** Verifies a token. */', { commitSha: SHA, startLine: 1 }),
  ];
  const result = await semanticSearch(snap, { query: 'q', k: 1 }, fixed(docs));
  assert.deepEqual(result.evidence.map((e) => e.startLine), [6]);
  assert.equal(result.truncated, true);
  assert.deepEqual(await semanticSearch(snap, { query: 'q', k: 1 }, fixed(docs)), result);
});

test('invalid input and retriever failures are typed errors', async () => {
  const code = (c: string) => (err: unknown) => err instanceof ToolError && err.code === c;
  await assert.rejects(semanticSearch(snap, { query: '  ' }, fixed([])), code('INVALID_INPUT'));
  await assert.rejects(semanticSearch(snap, { query: 'q', k: 0 }, fixed([])), code('INVALID_INPUT'));
  await assert.rejects(
    semanticSearch(snap, { query: 'q' }, async () => {
      throw new Error('fetch failed');
    }),
    (err: unknown) => err instanceof ToolError && err.code === 'UNAVAILABLE' && /fetch failed/.test(err.message),
  );
});

test('semantic evidence is citable through the shared citation layer', async () => {
  const store = EvidenceStore.forSnapshot(snap);
  store.addResult(
    await semanticSearch(
      snap,
      { query: 'verify' },
      fixed([doc('/** Verifies a token. */\nexport function verify(t: string) {\nreturn t.length > 0;\n}', {
        commitSha: SHA,
        startLine: 1,
      })]),
    ),
  );
  const { citations } = store.cite([{ evidenceId: 'E1', startLine: 3, endLine: 3 }]);
  assert.equal(citations[0].snippet, '  return t.length > 0;');
});
