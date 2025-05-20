import { simpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs/promises';

// https://www.npmjs.com/package/simple-git
// More on SHA-1: https://graphite.dev/guides/git-hash
export async function cloneRepo(url: string, sha = 'HEAD') {
  // Grab just the repo name
  const repoName = url
    .split('/')
    .pop()!
    .replace(/\.git$/, '');
  const localRepoPath = path.resolve('.cache', 'repos', repoName, sha);

  try {
    // Check if the repo was already cloned
    if (
      await fs
        .access(localRepoPath)
        .then(() => true)
        .catch(() => false)
    ) {
      return localRepoPath;
    }

    // Make a shallow clone of the repo (without previous commits)
    await simpleGit().clone(url, localRepoPath, ['--depth', '1']);

    // Checkout exactly the commit we're asking for
    if (sha !== 'HEAD') {
      await simpleGit(localRepoPath).checkout(sha);
    }

    // Return path to the cloned repo
    return localRepoPath;
  } catch (err) {
    return new Error(`Error: ${err}`);
  }
}
