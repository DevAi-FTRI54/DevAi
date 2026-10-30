import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { gitFixture, tempDir } from './helpers/fixtures.js';
import {
  cloneRepo,
  generateUniqueRepoId,
  resolveCommitSha,
  snapshotPath,
} from '../src/features/indexing/git.service.js';

before(() => {
  process.env.REPO_CACHE_DIR = tempDir('devai-cache-');
});

test('HEAD resolves to the concrete commit SHA and is cached under it', async () => {
  const origin = gitFixture({ 'a.ts': 'export const a = 1;\n' });
  const { localRepoPath, repoId, commitSha } = await cloneRepo(origin.url);
  assert.equal(commitSha, origin.head());
  assert.equal(repoId, generateUniqueRepoId(origin.url));
  assert.equal(localRepoPath, snapshotPath(repoId, commitSha));
  assert.equal(path.basename(localRepoPath), commitSha);
  assert.ok(fs.existsSync(path.join(localRepoPath, 'a.ts')));
  const leftovers = fs.readdirSync(path.dirname(localRepoPath)).filter((d) => d.startsWith('.tmp-'));
  assert.deepEqual(leftovers, []);
});

test('a moved HEAD produces a new snapshot and leaves the old one intact', async () => {
  const origin = gitFixture({ 'a.ts': 'v1\n' });
  const first = await cloneRepo(origin.url);
  const second = origin.commit({ 'a.ts': 'v2\n' });
  const next = await cloneRepo(origin.url);
  assert.equal(next.commitSha, second);
  assert.notEqual(next.localRepoPath, first.localRepoPath);
  assert.equal(fs.readFileSync(path.join(first.localRepoPath, 'a.ts'), 'utf8'), 'v1\n');
  assert.equal(fs.readFileSync(path.join(next.localRepoPath, 'a.ts'), 'utf8'), 'v2\n');
});

test('a full SHA is served from cache without contacting the remote', async () => {
  const origin = gitFixture({ 'a.ts': 'v1\n' });
  const { commitSha, localRepoPath } = await cloneRepo(origin.url);
  fs.rmSync(origin.url, { recursive: true, force: true });
  const again = await cloneRepo(origin.url, commitSha.toUpperCase());
  assert.equal(again.localRepoPath, localRepoPath);
  assert.equal(again.commitSha, commitSha);
});

test('branches, tags, and abbreviated SHAs resolve to full SHAs', async () => {
  const origin = gitFixture({ 'a.ts': 'v1\n' });
  const v1 = origin.head();
  origin.tag('v1.0');
  origin.branch('release');
  const v2 = origin.commit({ 'a.ts': 'v2\n' });

  assert.equal(await resolveCommitSha(origin.url, 'HEAD'), v2);
  assert.equal(await resolveCommitSha(origin.url, 'release'), v1);
  assert.equal(await resolveCommitSha(origin.url, 'v1.0'), v1);
  assert.equal(await resolveCommitSha(origin.url, v1.slice(0, 7)), null);

  const byBranch = await cloneRepo(origin.url, 'release');
  assert.equal(byBranch.commitSha, v1);
  const byShortSha = await cloneRepo(origin.url, v1.slice(0, 7));
  assert.equal(byShortSha.commitSha, v1);
  assert.equal(byShortSha.localRepoPath, byBranch.localRepoPath);
});

test('a failed clone leaves no temporary directory behind', async () => {
  const missing = path.join(tempDir(), 'does-not-exist');
  await assert.rejects(cloneRepo(missing));
  const repoDir = path.join(process.env.REPO_CACHE_DIR!, generateUniqueRepoId(missing));
  const leftovers = fs.existsSync(repoDir) ? fs.readdirSync(repoDir) : [];
  assert.deepEqual(leftovers, []);
});
