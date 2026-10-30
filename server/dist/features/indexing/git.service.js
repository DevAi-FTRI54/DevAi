import { simpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs/promises';
// Helper function for generating unique repoId
export const generateUniqueRepoId = (url) => {
    const baseId = url
        .replace(/(^\w+:|^)\/\//, '')
        .replace(/\.git$/, '')
        .replace(/\W+/g, '_');
    // Hash the baseId to guarantee uniqeueness
    return baseId;
};
// https://www.npmjs.com/package/simple-git
// More on SHA-1: https://graphite.dev/guides/git-hash
export async function cloneRepo(url, sha = 'HEAD') {
    // // Grab just the repo name
    // const repoName = url
    //   .split('/')
    //   .pop()!
    //   .replace(/\.git$/, '');
    const repoId = generateUniqueRepoId(url);
    const localRepoPath = path.resolve('.cache', 'repos', repoId, sha);
    try {
        // Check if the repo was already cloned
        await fs.access(localRepoPath);
        return { localRepoPath, repoId };
    }
    catch (err) {
        if (err?.code !== 'ENOENT')
            throw err; // Unexpected error;
    }
    // Shallow clone only gets the default-branch tip. If we need a specific SHA (e.g. from
    // frontend), that commit may not be in the shallow clone after a merge/rebase, causing
    // "reference is not a tree". So when sha !== 'HEAD' we do a full clone so checkout works.
    if (sha !== 'HEAD') {
        await simpleGit().clone(url, localRepoPath);
        await simpleGit(localRepoPath).checkout(sha);
    }
    else {
        await simpleGit().clone(url, localRepoPath, ['--depth', '1']);
    }
    // Return path to the cloned repo
    return { localRepoPath, repoId };
}
