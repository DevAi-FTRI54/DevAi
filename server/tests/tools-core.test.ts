import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { gitFixture, tempDir, writeFiles } from './helpers/fixtures.js';
import { RepoSnapshot, MAX_FILE_BYTES } from '../src/features/tools/snapshot.js';
import { EvidenceStore } from '../src/features/tools/evidence-store.js';
import { ToolError } from '../src/features/tools/types.js';
import { snapshotPath } from '../src/features/indexing/git.service.js';

const SHA = '1'.repeat(40);

before(() => {
  process.env.REPO_CACHE_DIR = tempDir('devai-cache-');
});

function fixtureSnapshot(files: Record<string, string>): RepoSnapshot {
  const root = tempDir('devai-snap-');
  writeFiles(root, files);
  return new RepoSnapshot('acme_widgets', SHA, root);
}

const rejects = (fn: () => unknown, code: string) =>
  assert.throws(fn, (err: unknown) => err instanceof ToolError && err.code === code);

test('open() reads a cached snapshot by SHA and refuses missing or abbreviated SHAs', () => {
  writeFiles(snapshotPath('acme_widgets', SHA), { 'a.ts': 'x\n' });
  const snap = RepoSnapshot.open('acme_widgets', SHA.toUpperCase());
  assert.equal(snap.commitSha, SHA);
  assert.deepEqual(snap.listFiles(), ['a.ts']);
  rejects(() => RepoSnapshot.open('acme_widgets', '2'.repeat(40)), 'SNAPSHOT_NOT_FOUND');
  rejects(() => RepoSnapshot.open('acme_widgets', 'abc1234'), 'INVALID_INPUT');
});

test('checkout() pins a git repository to its resolved commit', async () => {
  const origin = gitFixture({ 'src/a.ts': 'export const a = 1;\n' });
  const snap = await RepoSnapshot.checkout(origin.url);
  assert.equal(snap.commitSha, origin.head());
  assert.deepEqual(snap.readLines('src/a.ts'), ['export const a = 1;']);
});

test('listFiles is sorted and skips vendored, generated, binary and oversized files', () => {
  const snap = fixtureSnapshot({
    'src/b.ts': 'b\n',
    'src/a.ts': 'a\n',
    'README.md': '# hi\n',
    'node_modules/lib/index.js': 'x\n',
    'dist/out.js': 'x\n',
    '.git/HEAD': 'ref\n',
    'img.png': 'PNG\u0000\u0001',
    'huge.txt': 'x'.repeat(MAX_FILE_BYTES + 1),
  });
  assert.deepEqual(snap.listFiles(), ['README.md', 'src/a.ts', 'src/b.ts']);
});

test('paths are normalized and cannot escape the snapshot', () => {
  const snap = fixtureSnapshot({ 'src/a.ts': 'a\n' });
  const outside = tempDir('devai-outside-');
  writeFiles(outside, { 'secret.txt': 'secret\n' });
  fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(snap.root, 'link.txt'));

  assert.equal(snap.normalizePath('./src//a.ts'), 'src/a.ts');
  assert.equal(snap.normalizePath('src\\a.ts'), 'src/a.ts');
  rejects(() => snap.readLines('../secret.txt'), 'INVALID_INPUT');
  rejects(() => snap.readLines('src/../../secret.txt'), 'INVALID_INPUT');
  rejects(() => snap.readLines('/etc/passwd'), 'INVALID_INPUT');
  rejects(() => snap.readLines('link.txt'), 'INVALID_INPUT');
  rejects(() => snap.readLines('src/missing.ts'), 'FILE_NOT_FOUND');
  assert.equal(snap.listFiles().includes('link.txt'), false);
});

test('evidence() copies exact snapshot text and clamps the range', () => {
  const snap = fixtureSnapshot({ 'src/a.ts': 'one\n  two\nthree\n' });
  const ev = snap.evidence('src/a.ts', 2, 99, 'readFile', 'a.ts');
  assert.deepEqual(ev, {
    repoId: 'acme_widgets',
    commitSha: SHA,
    filePath: 'src/a.ts',
    startLine: 2,
    endLine: 3,
    content: '  two\nthree',
    source: 'readFile',
    label: 'a.ts',
  });
});

test('EvidenceStore assigns sequential IDs across tools and dedupes identical ranges', () => {
  const snap = fixtureSnapshot({ 'src/a.ts': 'one\ntwo\nthree\n', 'src/b.ts': 'b\n' });
  const store = EvidenceStore.forSnapshot(snap);
  const first = store.add([snap.evidence('src/a.ts', 1, 2, 'readFile')]);
  const second = store.addResult({
    tool: 'grepSearch',
    truncated: false,
    evidence: [snap.evidence('src/b.ts', 1, 1, 'grepSearch'), snap.evidence('src/a.ts', 1, 2, 'grepSearch')],
  });
  assert.deepEqual(first.map((e) => e.id), ['E1']);
  assert.deepEqual(second.map((e) => e.id), ['E2', 'E1']);
  assert.equal(store.all().length, 2);
  assert.equal(store.get('E2')?.filePath, 'src/b.ts');
});

test('EvidenceStore citations are copied from the snapshot through the deterministic layer', () => {
  const snap = fixtureSnapshot({ 'src/a.ts': 'function f() {\n  return 1;\n}\n' });
  const store = EvidenceStore.forSnapshot(snap);
  store.add([{ ...snap.evidence('src/a.ts', 1, 3, 'findDefinition', 'f'), content: 'function f() {\nreturn 1;\n}' }]);

  const { citations, diagnostics } = store.cite([
    { evidenceId: 'e1', startLine: 2, endLine: 2 },
    { evidenceId: 'E9', startLine: 1, endLine: 1 },
  ]);
  assert.deepEqual(citations, [
    { evidenceId: 'E1', file: 'src/a.ts', startLine: 2, endLine: 2, snippet: '  return 1;' },
  ]);
  assert.equal(diagnostics.unknownEvidence, 1);
});

test('EvidenceStore.format numbers lines and shows labels', () => {
  const snap = fixtureSnapshot({ 'src/a.ts': 'one\ntwo\n' });
  const store = EvidenceStore.forSnapshot(snap);
  store.add([snap.evidence('src/a.ts', 1, 2, 'findDefinition', 'one')]);
  assert.equal(store.format(), '[E1] NAME: one\nFILE: src/a.ts (lines 1-2)\n---\n1| one\n2| two\n====\n');
});
