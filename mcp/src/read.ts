import fs from 'node:fs';
import path from 'node:path';
import {
  isProbablyBinary,
  matchesGlob,
  resolveInsideRepo,
  shouldIgnore,
  toRepoPath,
  walkFiles,
} from './repo.js';

export const DEFAULT_MAX_BYTES = 120_000;

export type ReadArgs = {
  path?: string;
  glob?: string;
  maxBytes?: number;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileText(absPath: string, remaining: number): { text: string; used: number; truncated: boolean } {
  const stat = fs.statSync(absPath);
  const toRead = Math.min(stat.size, remaining);
  const fd = fs.openSync(absPath, 'r');
  try {
    const buf = Buffer.alloc(toRead);
    const bytes = fs.readSync(fd, buf, 0, toRead, 0);
    const truncated = bytes < stat.size;
    return {
      text: buf.subarray(0, bytes).toString('utf8'),
      used: bytes,
      truncated,
    };
  } finally {
    fs.closeSync(fd);
  }
}

function listTree(repoRoot: string, startAbs: string, startRel: string): string {
  const files = walkFiles(repoRoot, startAbs);
  if (files.length === 0) {
    return `No readable source files under ${startRel}.`;
  }

  const lines = files.map((file) => {
    const abs = path.join(repoRoot, file);
    try {
      const size = fs.statSync(abs).size;
      return `${file}  (${formatSize(size)})`;
    } catch {
      return file;
    }
  });

  const heading =
    startRel === '.'
      ? `DevAI source tree (${files.length} files). Pass a file path to read contents, or a glob such as server/src/**/*.ts.`
      : `Files under ${startRel} (${files.length}). Pass a file path to read contents.`;

  return [heading, '', ...lines].join('\n');
}

function readOneFile(repoRoot: string, absPath: string, repoPath: string, maxBytes: number): string {
  if (shouldIgnore(repoPath)) {
    throw new Error(`Refusing to read ignored or secret path: ${repoPath}`);
  }
  if (isProbablyBinary(absPath)) {
    throw new Error(`Refusing to read binary file: ${repoPath}`);
  }

  const { text, truncated } = readFileText(absPath, maxBytes);
  const header = truncated
    ? `# ${repoPath} (truncated at ${formatSize(maxBytes)}; pass maxBytes or a smaller path)`
    : `# ${repoPath}`;
  return `${header}\n${text}`;
}

function readGlob(repoRoot: string, startAbs: string, glob: string, maxBytes: number): string {
  const startRel = toRepoPath(repoRoot, startAbs);
  const files = walkFiles(repoRoot, startAbs).filter((file) => {
    const local = startRel === '.' ? file : file.slice(startRel.length + 1);
    return matchesGlob(file, glob) || matchesGlob(local, glob);
  });

  if (files.length === 0) {
    return `No files matched glob ${JSON.stringify(glob)}.`;
  }

  const parts: string[] = [];
  let used = 0;
  let included = 0;

  for (const file of files) {
    if (used >= maxBytes) break;
    const abs = path.join(repoRoot, file);
    if (shouldIgnore(file) || isProbablyBinary(abs)) continue;

    const remaining = maxBytes - used;
    const { text, used: fileUsed, truncated } = readFileText(abs, remaining);
    used += fileUsed;
    included += 1;
    const label = truncated ? `${file} (truncated)` : file;
    parts.push(`--- ${label} ---`, text.replace(/\s+$/, ''), '');
  }

  const omitted = files.length - included;
  const summary = [
    `Read ${included} of ${files.length} files matching ${JSON.stringify(glob)} (${formatSize(used)}).`,
    omitted > 0
      ? `${omitted} file(s) omitted by the byte cap. Pass a narrower glob or raise maxBytes.`
      : null,
    '',
  ].filter((line) => line !== null);

  return [...summary, ...parts].join('\n').trimEnd();
}

export function readRepo(repoRoot: string, args: ReadArgs): string {
  const maxBytes = args.maxBytes ?? DEFAULT_MAX_BYTES;
  const rel = args.path?.trim() || '.';
  const abs = resolveInsideRepo(repoRoot, rel);
  const repoPath = toRepoPath(repoRoot, abs);

  if (!fs.existsSync(abs)) {
    throw new Error(`Not found: ${repoPath}`);
  }

  const stat = fs.lstatSync(abs);
  if (stat.isSymbolicLink()) {
    throw new Error(`Refusing to follow symlink: ${repoPath}`);
  }

  if (args.glob) {
    const startAbs = stat.isDirectory() ? abs : path.dirname(abs);
    return readGlob(repoRoot, startAbs, args.glob, maxBytes);
  }

  if (stat.isDirectory()) {
    return listTree(repoRoot, abs, repoPath);
  }

  if (!stat.isFile()) {
    throw new Error(`Not a readable file: ${repoPath}`);
  }

  return readOneFile(repoRoot, abs, repoPath, maxBytes);
}
