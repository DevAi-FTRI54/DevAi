// A repository pinned to one commit. Every tool reads through this so results are reproducible
// and tied to the same commit the index was built from.
import fs from 'fs';
import path from 'path';
import { cloneRepo, snapshotPath } from '../indexing/git.service.js';
import { contentLines, type EvidenceSource } from '../queries/evidence.js';
import { ToolError, type ToolEvidence } from './types.js';

const FULL_SHA = /^[0-9a-f]{40}$/i;
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.cache', '.next']);
export const MAX_FILE_BYTES = 1024 * 1024;

const toPosix = (p: string) => p.split(path.sep).join('/');

function isBinary(abs: string): boolean {
  const fd = fs.openSync(abs, 'r');
  try {
    const buf = Buffer.alloc(8000);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    return buf.subarray(0, n).includes(0);
  } finally {
    fs.closeSync(fd);
  }
}

export class RepoSnapshot {
  readonly commitSha: string;
  readonly root: string;
  private files?: string[];
  private lineCache = new Map<string, string[]>();

  constructor(
    readonly repoId: string,
    commitSha: string,
    root: string,
  ) {
    if (!FULL_SHA.test(commitSha)) {
      throw new ToolError('INVALID_INPUT', `commitSha must be a full 40-character SHA, got "${commitSha}"`);
    }
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      throw new ToolError('SNAPSHOT_NOT_FOUND', `No snapshot for ${repoId}@${commitSha} at ${root}`);
    }
    this.commitSha = commitSha.toLowerCase();
    this.root = fs.realpathSync(root);
  }

  // Opens an already-cached snapshot; never fetches.
  static open(repoId: string, commitSha: string): RepoSnapshot {
    if (!FULL_SHA.test(commitSha)) {
      throw new ToolError('INVALID_INPUT', `commitSha must be a full 40-character SHA, got "${commitSha}"`);
    }
    return new RepoSnapshot(repoId, commitSha, snapshotPath(repoId, commitSha));
  }

  static async checkout(url: string, ref = 'HEAD'): Promise<RepoSnapshot> {
    const { localRepoPath, repoId, commitSha } = await cloneRepo(url, ref);
    return new RepoSnapshot(repoId, commitSha, localRepoPath);
  }

  // Normalizes a repo-relative path and rejects anything that escapes the snapshot.
  normalizePath(filePath: string): string {
    const raw = String(filePath ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
    if (!raw || path.posix.isAbsolute(raw) || path.win32.isAbsolute(raw)) {
      throw new ToolError('INVALID_INPUT', `Path must be relative to the repository root: "${filePath}"`);
    }
    const rel = path.posix.normalize(raw);
    if (rel === '..' || rel.startsWith('../')) {
      throw new ToolError('INVALID_INPUT', `Path escapes the repository: "${filePath}"`);
    }
    return rel;
  }

  private absolute(rel: string): string {
    const abs = path.join(this.root, rel);
    let real: string;
    try {
      real = fs.realpathSync(abs);
    } catch {
      throw new ToolError('FILE_NOT_FOUND', `File not found at ${this.commitSha.slice(0, 7)}: ${rel}`);
    }
    if (!real.startsWith(this.root + path.sep)) {
      throw new ToolError('INVALID_INPUT', `Path escapes the repository: "${rel}"`);
    }
    return real;
  }

  // Repo-relative POSIX paths of readable text files, sorted for deterministic output.
  listFiles(): string[] {
    if (this.files) return this.files;
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name)) walk(abs);
        } else if (entry.isFile()) {
          if (fs.statSync(abs).size <= MAX_FILE_BYTES && !isBinary(abs)) {
            out.push(toPosix(path.relative(this.root, abs)));
          }
        }
      }
    };
    walk(this.root);
    this.files = out.sort();
    return this.files;
  }

  hasFile(filePath: string): boolean {
    try {
      return this.listFiles().includes(this.normalizePath(filePath));
    } catch {
      return false;
    }
  }

  readLines(filePath: string): string[] {
    const rel = this.normalizePath(filePath);
    const cached = this.lineCache.get(rel);
    if (cached) return cached;
    const abs = this.absolute(rel);
    if (!fs.statSync(abs).isFile()) {
      throw new ToolError('FILE_NOT_FOUND', `Not a file: ${rel}`);
    }
    if (fs.statSync(abs).size > MAX_FILE_BYTES || isBinary(abs)) {
      throw new ToolError('INVALID_INPUT', `Not a readable text file (binary or over 1MB): ${rel}`);
    }
    const lines = contentLines(fs.readFileSync(abs, 'utf8'));
    this.lineCache.set(rel, lines);
    return lines;
  }

  // Builds evidence from the snapshot's exact text for a 1-based inclusive range.
  evidence(
    filePath: string,
    startLine: number,
    endLine: number,
    source: EvidenceSource,
    label?: string,
  ): ToolEvidence {
    const rel = this.normalizePath(filePath);
    const lines = this.readLines(rel);
    const start = Math.max(1, Math.min(startLine, lines.length || 1));
    const end = Math.max(start, Math.min(endLine, lines.length || 1));
    return {
      repoId: this.repoId,
      commitSha: this.commitSha,
      filePath: rel,
      startLine: start,
      endLine: end,
      content: lines.slice(start - 1, end).join('\n'),
      source,
      ...(label && { label }),
    };
  }
}
