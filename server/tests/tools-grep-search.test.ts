import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tempDir, writeFiles } from './helpers/fixtures.js';
import { RepoSnapshot } from '../src/features/tools/snapshot.js';
import { grepSearch } from '../src/features/tools/grep-search.js';
import { EvidenceStore } from '../src/features/tools/evidence-store.js';
import { ToolError } from '../src/features/tools/types.js';

const SHA = 'cd'.repeat(20);

const root = tempDir('devai-snap-');
writeFiles(root, {
  'src/server.ts': [
    "import express from 'express';", //  1
    '', //                                  2
    'const app = express();', //            3
    "app.get('/health', h);", //            4
    "app.post('/query', q);", //            5
    '', //                                  6
    '', //                                  7
    '', //                                  8
    '', //                                  9
    '', //                                 10
    'app.listen(3000);', //                11
  ].join('\n') + '\n',
  'src/util.ts': 'export const QUERY_LIMIT = 5;\nexport const re = /a.b(c)?/;\n',
  'client/app.tsx': 'fetch("/query");\n',
  'README.md': 'Run app.listen via npm start.\n',
  'node_modules/express/index.js': 'app.listen(1);\n',
});
const snap = new RepoSnapshot('acme_widgets', SHA, root);

const rejectsWith = (p: Promise<unknown>, code: string) =>
  assert.rejects(p, (err: unknown) => err instanceof ToolError && err.code === code);

const ranges = (r: Awaited<ReturnType<typeof grepSearch>>) =>
  r.evidence.map((e) => `${e.filePath}:${e.startLine}-${e.endLine}`);

test('literal search is case-insensitive by default, sorted by path, and skips vendored files', async () => {
  const result = await grepSearch(snap, { pattern: 'app.listen', contextLines: 0 });
  assert.deepEqual(ranges(result), ['README.md:1-1', 'src/server.ts:11-11']);
  assert.equal(result.truncated, false);
  assert.equal(result.note, '2 matching lines in 2 files.');
  for (const e of result.evidence) {
    assert.equal(e.source, 'grepSearch');
    assert.equal(e.commitSha, SHA);
    assert.equal(e.repoId, 'acme_widgets');
  }
});

test('regex metacharacters are literal unless regex is set', async () => {
  const literal = await grepSearch(snap, { pattern: '/a.b(c)?/', contextLines: 0 });
  assert.deepEqual(ranges(literal), ['src/util.ts:2-2']);

  const regex = await grepSearch(snap, { pattern: "app\\.(get|post)\\('", regex: true, contextLines: 0 });
  assert.deepEqual(ranges(regex), ['src/server.ts:4-5']);
  assert.equal(regex.evidence[0].label, 'match at lines 4, 5');
});

test('caseSensitive distinguishes QUERY from query', async () => {
  const insensitive = await grepSearch(snap, { pattern: 'query', contextLines: 0 });
  assert.deepEqual(ranges(insensitive), ['client/app.tsx:1-1', 'src/server.ts:5-5', 'src/util.ts:1-1']);
  const sensitive = await grepSearch(snap, { pattern: 'QUERY', caseSensitive: true, contextLines: 0 });
  assert.deepEqual(ranges(sensitive), ['src/util.ts:1-1']);
});

test('include globs filter by path, and bare globs match file names anywhere', async () => {
  const bySrc = await grepSearch(snap, { pattern: 'query', include: 'src/**', contextLines: 0 });
  assert.deepEqual(ranges(bySrc), ['src/server.ts:5-5', 'src/util.ts:1-1']);
  const byName = await grepSearch(snap, { pattern: 'query', include: ['*.tsx', '*.md'], contextLines: 0 });
  assert.deepEqual(ranges(byName), ['client/app.tsx:1-1']);
});

test('nearby matches share one context window; distant ones get their own', async () => {
  const result = await grepSearch(snap, { pattern: 'app', include: 'src/server.ts', contextLines: 1 });
  assert.deepEqual(ranges(result), ['src/server.ts:2-6', 'src/server.ts:10-11']);
  assert.equal(result.evidence[0].label, 'match at lines 3, 4, 5');
  assert.equal(result.evidence[0].content, "\nconst app = express();\napp.get('/health', h);\napp.post('/query', q);\n");
  assert.equal(result.evidence[1].label, 'match at line 11');
});

test('maxResults truncates deterministically and says so', async () => {
  const first = await grepSearch(snap, { pattern: 'app', maxResults: 2, contextLines: 0 });
  const again = await grepSearch(snap, { pattern: 'app', maxResults: 2, contextLines: 0 });
  assert.deepEqual(first, again);
  assert.equal(first.truncated, true);
  assert.deepEqual(ranges(first), ['README.md:1-1', 'src/server.ts:3-3']);
  assert.equal(first.note, '2 matching lines in 2 files; stopped at maxResults=2.');
});

test('no matches returns empty evidence, not an error', async () => {
  const result = await grepSearch(snap, { pattern: 'definitely-not-present' });
  assert.deepEqual(result.evidence, []);
  assert.equal(result.truncated, false);
  assert.equal(result.note, '0 matching lines in 0 files.');
});

test('bad input is a typed error', async () => {
  await rejectsWith(grepSearch(snap, { pattern: '' }), 'INVALID_INPUT');
  await rejectsWith(grepSearch(snap, { pattern: '(', regex: true }), 'INVALID_INPUT');
  await rejectsWith(grepSearch(snap, { pattern: 'x', maxResults: 0 }), 'INVALID_INPUT');
  await rejectsWith(grepSearch(snap, { pattern: 'x', contextLines: 50 }), 'INVALID_INPUT');
  await rejectsWith(grepSearch(snap, { pattern: 'x', include: [''] }), 'INVALID_INPUT');
});

test('grep evidence is citable through the shared citation layer', async () => {
  const store = EvidenceStore.forSnapshot(snap);
  store.addResult(await grepSearch(snap, { pattern: 'app.post', contextLines: 1 }));
  const { citations } = store.cite([{ evidenceId: 'E1', startLine: 5, endLine: 5 }]);
  assert.deepEqual(citations, [
    { evidenceId: 'E1', file: 'src/server.ts', startLine: 5, endLine: 5, snippet: "app.post('/query', q);" },
  ]);
});
