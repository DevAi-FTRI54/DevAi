import fs from 'fs';
import path from 'path';
import { snapshotPath } from '../../src/features/indexing/git.service.js';

export function clonePath(repoId: string, sha: string): string {
  return snapshotPath(repoId, sha);
}

const cache = new Map<string, string[] | null>();

export function readRepoLines(
  root: string,
  relPath: string,
): string[] | null {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\.?\//, '');
  const key = `${root}::${normalized}`;
  if (cache.has(key)) return cache.get(key)!;
  const abs = path.join(root, normalized);
  let lines: string[] | null = null;
  if (abs.startsWith(root) && fs.existsSync(abs) && fs.statSync(abs).isFile()) {
    lines = fs.readFileSync(abs, 'utf8').split('\n');
  }
  cache.set(key, lines);
  return lines;
}

export const normalizeWs = (s: string) => s.replace(/\s+/g, ' ').trim();
