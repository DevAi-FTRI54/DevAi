import { simpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'node:crypto';

// Helper function for generating unique repoId

export const generateUniqueRepoId = (url: string): string => {
  const baseId = url
    .replace(/(^\w+:|^)\/\//, '')
    .replace(/\.git$/, '')
    .replace(/\W+/g, '_');

  // Hash the baseId to guarantee uniqeueness

  return baseId;
};

const FULL_SHA = /^[0-9a-f]{40}$/i;

export const repoCacheRoot = (): string =>
  path.resolve(process.env.REPO_CACHE_DIR ?? path.join('.cache', 'repos'));

// A snapshot is one repo at one commit; its directory name is always the full commit SHA.
export const snapshotPath = (repoId: string, commitSha: string): string =>
  path.join(repoCacheRoot(), repoId, commitSha.toLowerCase());

const exists = (p: string) =>
  fs.access(p).then(
    () => true,
    () => false,
  );

// Resolve a ref (HEAD, branch, tag, or full SHA) to a full commit SHA without cloning.
// Returns null when the remote cannot answer (e.g. an abbreviated SHA); cloning resolves those.
export async function resolveCommitSha(url: string, ref = 'HEAD'): Promise<string | null> {
  if (FULL_SHA.test(ref)) return ref.toLowerCase();
  try {
    const out = await simpleGit().listRemote([url, ref]);
    const rows = out
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split('\t') as [string, string]);
    const wanted = ref === 'HEAD' ? ['HEAD'] : [`refs/heads/${ref}`, `refs/tags/${ref}^{}`, `refs/tags/${ref}`, ref];
    for (const name of wanted) {
      const row = rows.find(([, r]) => r === name);
      if (row && FULL_SHA.test(row[0])) return row[0].toLowerCase();
    }
    return null;
  } catch {
    return null;
  }
}

// https://www.npmjs.com/package/simple-git
// More on SHA-1: https://graphite.dev/guides/git-hash
export async function cloneRepo(
  url: string,
  ref = 'HEAD',
): Promise<{ localRepoPath: string; repoId: string; commitSha: string }> {
  const repoId = generateUniqueRepoId(url);

  const knownSha = await resolveCommitSha(url, ref);
  if (knownSha && (await exists(snapshotPath(repoId, knownSha)))) {
    return { localRepoPath: snapshotPath(repoId, knownSha), repoId, commitSha: knownSha };
  }

  const tmpPath = path.join(repoCacheRoot(), repoId, `.tmp-${crypto.randomUUID()}`);
  await fs.mkdir(path.dirname(tmpPath), { recursive: true });
  try {
    // Shallow clone only gets the default-branch tip. Any other ref (e.g. a SHA from the
    // frontend) may not be in a shallow clone after a merge/rebase, so do a full clone and checkout.
    if (ref === 'HEAD') {
      await simpleGit().clone(url, tmpPath, ['--depth', '1']);
    } else {
      await simpleGit().clone(url, tmpPath);
      await simpleGit(tmpPath).checkout(knownSha ?? ref);
    }
    // The checked-out commit is authoritative (the remote may have moved since ls-remote).
    const commitSha = (await simpleGit(tmpPath).revparse(['HEAD'])).trim().toLowerCase();
    const localRepoPath = snapshotPath(repoId, commitSha);
    if (await exists(localRepoPath)) {
      await fs.rm(tmpPath, { recursive: true, force: true });
    } else {
      await fs.rename(tmpPath, localRepoPath);
    }
    return { localRepoPath, repoId, commitSha };
  } catch (err) {
    await fs.rm(tmpPath, { recursive: true, force: true });
    throw err;
  }
}
