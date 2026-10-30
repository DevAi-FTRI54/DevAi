import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IGNORE_DIRS = new Set([
  '.anima',
  '.cache',
  '.git',
  '.idea',
  '.vscode',
  '__pycache__',
  'coverage',
  'dist',
  'logs',
  'node_modules',
  'venv',
]);

const IGNORE_FILES = new Set(['.DS_Store']);

const SECRET_NAMES = new Set(['.env', '.pem']);

const BINARY_EXT = new Set([
  '.eot',
  '.gif',
  '.gz',
  '.ico',
  '.jpeg',
  '.jpg',
  '.mp4',
  '.pdf',
  '.png',
  '.ttf',
  '.wasm',
  '.webp',
  '.woff',
  '.woff2',
  '.zip',
]);

export function resolveRepoRoot(): string {
  if (process.env.DEVAI_REPO_ROOT) {
    return path.resolve(process.env.DEVAI_REPO_ROOT);
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..');
}

export function resolveInsideRepo(repoRoot: string, relPath: string): string {
  const root = path.resolve(repoRoot);
  const requested = relPath.trim() === '' ? '.' : relPath;
  const abs = path.resolve(root, requested);
  const rel = path.relative(root, abs);

  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Path escapes the repository: ${relPath}`);
  }

  return abs;
}

export function toRepoPath(repoRoot: string, absPath: string): string {
  const rel = path.relative(repoRoot, absPath);
  return rel === '' ? '.' : rel.split(path.sep).join('/');
}

export function shouldIgnore(repoPath: string): boolean {
  const parts = repoPath.split('/');
  const name = parts[parts.length - 1] ?? '';

  if (parts.some((part) => IGNORE_DIRS.has(part))) return true;
  if (IGNORE_FILES.has(name)) return true;
  if (name === '.env' || (name.startsWith('.env.') && name !== '.env.example' && name !== '.env.eval')) {
    return true;
  }
  if (name.endsWith('.pem') || SECRET_NAMES.has(path.extname(name))) return true;
  if (BINARY_EXT.has(path.extname(name).toLowerCase())) return true;

  return false;
}

export function isProbablyBinary(absPath: string): boolean {
  const ext = path.extname(absPath).toLowerCase();
  if (BINARY_EXT.has(ext)) return true;

  const fd = fs.openSync(absPath, 'r');
  try {
    const buf = Buffer.alloc(800);
    const bytes = fs.readSync(fd, buf, 0, buf.length, 0);
    return buf.subarray(0, bytes).includes(0);
  } finally {
    fs.closeSync(fd);
  }
}

export function expandBraces(pattern: string): string[] {
  const match = /\{([^{}]+)\}/.exec(pattern);
  if (!match || match.index === undefined) return [pattern];

  const options = match[1].split(',');
  const prefix = pattern.slice(0, match.index);
  const suffix = pattern.slice(match.index + match[0].length);
  return options.flatMap((option) => expandBraces(`${prefix}${option}${suffix}`));
}

export function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLESTAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLESTAR::/g, '.*');
  return new RegExp(`^${escaped}$`);
}

export function matchesGlob(repoPath: string, pattern: string): boolean {
  return expandBraces(pattern.replace(/^\.\//, '')).some((part) => globToRegExp(part).test(repoPath));
}

export function walkFiles(repoRoot: string, startAbs: string): string[] {
  const files: string[] = [];

  function visit(abs: string) {
    const rel = toRepoPath(repoRoot, abs);
    if (rel !== '.' && shouldIgnore(rel)) return;

    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(abs);
    } catch {
      return;
    }

    if (stat.isSymbolicLink()) return;

    if (stat.isDirectory()) {
      let entries: string[];
      try {
        entries = fs.readdirSync(abs);
      } catch {
        return;
      }
      for (const entry of entries.sort()) {
        visit(path.join(abs, entry));
      }
      return;
    }

    if (stat.isFile()) files.push(rel);
  }

  visit(startAbs);
  return files;
}
