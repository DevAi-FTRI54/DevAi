import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tempDir, writeFiles } from './helpers/fixtures.js';
import { RepoSnapshot } from '../src/features/tools/snapshot.js';
import { readFile, READ_FILE_MAX_LINES } from '../src/features/tools/read-file.js';
import { EvidenceStore } from '../src/features/tools/evidence-store.js';
import { ToolError } from '../src/features/tools/types.js';

const SHA = 'ab'.repeat(20);
const numbered = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n') + '\n';

const root = tempDir('devai-snap-');
writeFiles(root, {
  'src/app.ts': 'import x from "y";\n\nexport function main() {\n  return x;\n}\n',
  'big.txt': numbered(READ_FILE_MAX_LINES + 50),
  'empty.ts': '',
});
const snap = new RepoSnapshot('acme_widgets', SHA, root);

const rejectsWith = (p: Promise<unknown>, code: string) =>
  assert.rejects(p, (err: unknown) => err instanceof ToolError && err.code === code);

test('reads a whole small file as one evidence item pinned to the snapshot', async () => {
  const result = await readFile(snap, { path: 'src/app.ts' });
  assert.equal(result.tool, 'readFile');
  assert.equal(result.truncated, false);
  assert.deepEqual(result.evidence, [
    {
      repoId: 'acme_widgets',
      commitSha: SHA,
      filePath: 'src/app.ts',
      startLine: 1,
      endLine: 5,
      content: 'import x from "y";\n\nexport function main() {\n  return x;\n}',
      source: 'readFile',
    },
  ]);
  assert.equal(result.note, 'Lines 1-5 of 5.');
});

test('reads an explicit range and clamps endLine to the file length', async () => {
  const { evidence } = await readFile(snap, { path: './src/app.ts', startLine: 3, endLine: 99 });
  assert.equal(evidence[0].filePath, 'src/app.ts');
  assert.equal(evidence[0].startLine, 3);
  assert.equal(evidence[0].endLine, 5);
  assert.equal(evidence[0].content, 'export function main() {\n  return x;\n}');
});

test('caps long reads and says where to continue', async () => {
  const first = await readFile(snap, { path: 'big.txt' });
  assert.equal(first.truncated, true);
  assert.equal(first.evidence[0].endLine, READ_FILE_MAX_LINES);
  assert.equal(first.note, `Showing lines 1-400 of 450; continue with startLine 401.`);

  const rest = await readFile(snap, { path: 'big.txt', startLine: 401 });
  assert.equal(rest.truncated, false);
  assert.equal(rest.evidence[0].startLine, 401);
  assert.equal(rest.evidence[0].endLine, 450);
  assert.equal(rest.evidence[0].content.split('\n')[0], 'line 401');
});

test('an empty file yields a single empty line', async () => {
  const { evidence } = await readFile(snap, { path: 'empty.ts' });
  assert.equal(evidence[0].startLine, 1);
  assert.equal(evidence[0].endLine, 1);
  assert.equal(evidence[0].content, '');
});

test('invalid input and missing files are typed errors', async () => {
  await rejectsWith(readFile(snap, { path: 'src/nope.ts' }), 'FILE_NOT_FOUND');
  await rejectsWith(readFile(snap, { path: '../etc/passwd' }), 'INVALID_INPUT');
  await rejectsWith(readFile(snap, { path: 'src/app.ts', startLine: 0 }), 'INVALID_INPUT');
  await rejectsWith(readFile(snap, { path: 'src/app.ts', startLine: 1.5 }), 'INVALID_INPUT');
  await rejectsWith(readFile(snap, { path: 'src/app.ts', startLine: 4, endLine: 2 }), 'INVALID_INPUT');
  await rejectsWith(readFile(snap, { path: 'src/app.ts', startLine: 6 }), 'INVALID_INPUT');
  await rejectsWith(readFile(snap, {} as never), 'INVALID_INPUT');
});

test('readFile evidence is citable through the shared citation layer', async () => {
  const store = EvidenceStore.forSnapshot(snap);
  store.addResult(await readFile(snap, { path: 'src/app.ts' }));
  const { citations } = store.cite([{ evidenceId: 'E1', startLine: 3, endLine: 5 }]);
  assert.deepEqual(citations, [
    {
      evidenceId: 'E1',
      file: 'src/app.ts',
      startLine: 3,
      endLine: 5,
      snippet: 'export function main() {\n  return x;\n}',
    },
  ]);
});
