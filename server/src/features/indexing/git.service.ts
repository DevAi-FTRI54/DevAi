import { simpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'node:crypto';

// Helper function for generating unique repoId

export const generateUnqiueRepoId = (url: string): string =>
  url
    .replace(/(^\w+:|^)\/\//, '')
    .replace(/\.git$/, '')
    .replace(/\W+/g, '_');

// https://www.npmjs.com/package/simple-git
// More on SHA-1: https://graphite.dev/guides/git-hash
export async function cloneRepo(
  url: string,
  sha = 'HEAD'
): Promise<{ localRepoPath: string; repoId: string }> {
  // // Grab just the repo name
  // const repoName = url
  //   .split('/')
  //   .pop()!
  //   .replace(/\.git$/, '');
  const repoId = generateUnqiueRepoId(url);
  const localRepoPath = path.resolve('.cache', 'repos', repoId, sha);

  try {
    // Check if the repo was already cloned
    await fs.access(localRepoPath);
    return { localRepoPath, repoId };
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err; // Unexpected error;
  }

  // Make a shallow clone of the repo (without previous commits)
  await simpleGit().clone(url, localRepoPath, ['--depth', '1']);

  // Checkout exactly the commit we're asking for
  if (sha !== 'HEAD') {
    await simpleGit(localRepoPath).checkout(sha);
  }

  // Return path to the cloned repo
  return { localRepoPath, repoId };
}
