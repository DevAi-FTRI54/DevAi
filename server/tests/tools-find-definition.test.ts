import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tempDir, writeFiles } from './helpers/fixtures.js';
import { RepoSnapshot } from '../src/features/tools/snapshot.js';
import { findDefinition } from '../src/features/tools/find-definition.js';
import { EvidenceStore } from '../src/features/tools/evidence-store.js';
import { ToolError } from '../src/features/tools/types.js';

const SHA = '9a'.repeat(20);

const root = tempDir('devai-snap-');
writeFiles(root, {
  'src/auth.ts': [
    "import jwt from 'jsonwebtoken';", //           1
    '', //                                          2
    '/**', //                                       3
    ' * Verifies a session token.', //              4
    ' */', //                                       5
    'export function verify(token: string) {', //   6
    '  const verify = token.trim();', //            7
    '  return verify.length > 0;', //               8
    '}', //                                         9
    '', //                                         10
    'export class AuthService {', //               11
    '  private secret = "s";', //                  12
    '', //                                         13
    '  /** Checks a token. */', //                 14
    '  verify(token: string) {', //                15
    '    return jwt.verify(token, this.secret);', // 16
    '  }', //                                      17
    '}', //                                        18
  ].join('\n') + '\n',
  'src/types.ts': [
    'export interface User {', //                   1
    '  id: string;', //                             2
    '}', //                                         3
    'export type Role = "admin" | "user";', //      4
    'export enum Status {', //                      5
    '  Active,', //                                 6
    '}', //                                         7
    '// A comment mentioning verify', //            8
    'export const MAX_USERS = 10;', //              9
    'export const a = 1, b = 2;', //               10
  ].join('\n') + '\n',
  'client/Button.tsx': [
    'export const Button = () => {', //             1
    '  return <button>ok</button>;', //             2
    '};', //                                        3
  ].join('\n') + '\n',
  'legacy/util.js': 'function helper() {\n  return 1;\n}\nmodule.exports = { helper };\n',
  'node_modules/lib/index.ts': 'export function verify() {}\n',
});
const snap = new RepoSnapshot('acme_widgets', SHA, root);

const defs = (r: Awaited<ReturnType<typeof findDefinition>>) =>
  r.evidence.map((e) => `${e.label} @ ${e.filePath}:${e.startLine}-${e.endLine}`);

test('finds a function with its JSDoc, plus same-named class members, but not locals or vendored code', async () => {
  const result = await findDefinition(snap, { symbol: 'verify' });
  assert.deepEqual(defs(result), [
    'function verify @ src/auth.ts:3-9',
    'method AuthService.verify @ src/auth.ts:14-17',
  ]);
  assert.equal(result.note, '2 definitions of verify.');
  assert.equal(result.evidence[0].content.split('\n')[3], 'export function verify(token: string) {');
  for (const e of result.evidence) {
    assert.equal(e.source, 'findDefinition');
    assert.equal(e.commitSha, SHA);
  }
});

test('a qualified Class.member name narrows to that member', async () => {
  const result = await findDefinition(snap, { symbol: 'AuthService.verify' });
  assert.deepEqual(defs(result), ['method AuthService.verify @ src/auth.ts:14-17']);
  assert.equal(result.evidence[0].content, '  /** Checks a token. */\n  verify(token: string) {\n    return jwt.verify(token, this.secret);\n  }');
});

test('kind filters results', async () => {
  const result = await findDefinition(snap, { symbol: 'verify', kind: 'method' });
  assert.deepEqual(defs(result), ['method AuthService.verify @ src/auth.ts:14-17']);
});

test('covers classes, properties, interfaces, type aliases, enums, variables, TSX and JS', async () => {
  const cases: Array<[string, string]> = [
    ['AuthService', 'class AuthService @ src/auth.ts:11-18'],
    ['AuthService.secret', 'property AuthService.secret @ src/auth.ts:12-12'],
    ['User', 'interface User @ src/types.ts:1-3'],
    ['Role', 'type Role @ src/types.ts:4-4'],
    ['Status', 'enum Status @ src/types.ts:5-7'],
    ['MAX_USERS', 'variable MAX_USERS @ src/types.ts:9-9'],
    ['b', 'variable b @ src/types.ts:10-10'],
    ['Button', 'variable Button @ client/Button.tsx:1-3'],
    ['helper', 'function helper @ legacy/util.js:1-3'],
  ];
  for (const [symbol, expected] of cases) {
    assert.deepEqual(defs(await findDefinition(snap, { symbol })), [expected], symbol);
  }
});

test('unknown symbols return no evidence and say so', async () => {
  const result = await findDefinition(snap, { symbol: 'doesNotExist' });
  assert.deepEqual(result.evidence, []);
  assert.equal(result.truncated, false);
  assert.equal(result.note, `No definition of doesNotExist found in ${SHA.slice(0, 7)}.`);
});

test('maxResults caps results and reports truncation', async () => {
  const result = await findDefinition(snap, { symbol: 'verify', maxResults: 1 });
  assert.deepEqual(defs(result), ['function verify @ src/auth.ts:3-9']);
  assert.equal(result.truncated, true);
  assert.equal(result.note, '2 definitions of verify; showing 1.');
});

test('invalid symbols are typed errors', async () => {
  for (const symbol of ['', 'a b', 'a.b.c', '1abc', 'x()']) {
    await assert.rejects(
      findDefinition(snap, { symbol }),
      (err: unknown) => err instanceof ToolError && err.code === 'INVALID_INPUT',
      symbol,
    );
  }
});

test('definition evidence is citable through the shared citation layer', async () => {
  const store = EvidenceStore.forSnapshot(snap);
  store.addResult(await findDefinition(snap, { symbol: 'AuthService.verify' }));
  const { citations } = store.cite([{ evidenceId: 'E1', startLine: 16, endLine: 16 }]);
  assert.equal(citations[0].snippet, '    return jwt.verify(token, this.secret);');
});
