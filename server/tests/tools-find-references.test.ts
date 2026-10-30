import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tempDir, writeFiles } from './helpers/fixtures.js';
import { RepoSnapshot } from '../src/features/tools/snapshot.js';
import { findReferences } from '../src/features/tools/find-references.js';
import { EvidenceStore } from '../src/features/tools/evidence-store.js';
import { ToolError } from '../src/features/tools/types.js';

const SHA = '7c'.repeat(20);

const root = tempDir('devai-snap-');
writeFiles(root, {
  'src/auth.ts': [
    '// verify is documented here but this comment is not a reference', // 1
    'export function verify(token: string) {', //                          2
    "  return token !== 'verify';", //                                     3
    '}', //                                                                4
    '', //                                                                 5
    '', //                                                                 6
    '', //                                                                 7
    'export const check = (t: string) => verify(t) && verify(t.trim());', // 8
  ].join('\n') + '\n',
  'src/routes.ts': [
    "import { verify } from './auth';", //   1
    '', //                                   2
    'router.use((req) => verify(req.token));', // 3
  ].join('\n') + '\n',
  'client/App.tsx': [
    'const verifyAll = 1;', //               1
    'export const App = () => <Verify onDone={verify} />;', // 2
  ].join('\n') + '\n',
  'README.md': 'call verify(token)\n',
  'node_modules/x/index.ts': 'verify();\n',
});
const snap = new RepoSnapshot('acme_widgets', SHA, root);

const refs = (r: Awaited<ReturnType<typeof findReferences>>) =>
  r.evidence.map((e) => `${e.filePath}:${e.startLine}-${e.endLine} ${e.label}`);

test('finds identifier uses across TS and TSX, skipping comments, strings, declarations and non-code files', async () => {
  const result = await findReferences(snap, { symbol: 'verify', contextLines: 0 });
  assert.deepEqual(refs(result), [
    'client/App.tsx:2-2 verify at line 2',
    'src/auth.ts:8-8 verify at line 8',
    'src/routes.ts:1-1 verify at line 1',
    'src/routes.ts:3-3 verify at line 3',
  ]);
  assert.equal(
    result.note,
    '4 lines referencing verify in 3 files. Matches are by name, so same-named symbols are included.',
  );
  for (const e of result.evidence) {
    assert.equal(e.source, 'findReferences');
    assert.equal(e.commitSha, SHA);
  }
});

test('includeDeclarations adds the declaring line', async () => {
  const result = await findReferences(snap, { symbol: 'verify', includeDeclarations: true, include: 'src/auth.ts', contextLines: 0 });
  assert.deepEqual(refs(result), ['src/auth.ts:2-2 verify at line 2', 'src/auth.ts:8-8 verify at line 8']);
});

test('context lines merge nearby references into one window', async () => {
  const result = await findReferences(snap, { symbol: 'verify', include: 'src/routes.ts', contextLines: 1 });
  assert.deepEqual(refs(result), ['src/routes.ts:1-3 verify at lines 1, 3']);
  assert.equal(result.evidence[0].content, "import { verify } from './auth';\n\nrouter.use((req) => verify(req.token));");
});

test('matching is exact and case-sensitive', async () => {
  const result = await findReferences(snap, { symbol: 'Verify', contextLines: 0 });
  assert.deepEqual(refs(result), ['client/App.tsx:2-2 Verify at line 2']);
  const none = await findReferences(snap, { symbol: 'verifyAl' });
  assert.deepEqual(none.evidence, []);
});

test('maxResults truncates deterministically', async () => {
  const first = await findReferences(snap, { symbol: 'verify', maxResults: 2, contextLines: 0 });
  assert.deepEqual(first, await findReferences(snap, { symbol: 'verify', maxResults: 2, contextLines: 0 }));
  assert.deepEqual(refs(first), ['client/App.tsx:2-2 verify at line 2', 'src/auth.ts:8-8 verify at line 8']);
  assert.equal(first.truncated, true);
  assert.match(first.note ?? '', /^2 lines referencing verify in 2 files; stopped at maxResults=2\./);
});

test('invalid input is a typed error', async () => {
  for (const input of [{ symbol: '' }, { symbol: 'a.b' }, { symbol: 'verify', maxResults: 0 }, { symbol: 'verify', include: [''] }]) {
    await assert.rejects(
      findReferences(snap, input),
      (err: unknown) => err instanceof ToolError && err.code === 'INVALID_INPUT',
      JSON.stringify(input),
    );
  }
});

test('reference evidence is citable through the shared citation layer', async () => {
  const store = EvidenceStore.forSnapshot(snap);
  store.addResult(await findReferences(snap, { symbol: 'verify', include: 'src/routes.ts' }));
  const { citations } = store.cite([{ evidenceId: 'E1', startLine: 3, endLine: 3 }]);
  assert.equal(citations[0].snippet, 'router.use((req) => verify(req.token));');
});
