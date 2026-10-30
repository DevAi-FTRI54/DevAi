// RAG v2.2 candidate expansion: after the first rerank, add every indexed chunk of the top files and of
// files one relative-import hop away (imports or imported-by), so the final rerank can pick the parts of a
// flow that the question's wording does not match directly.
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import type { Document } from '@langchain/core/documents';
import { cloneRepo, snapshotPath } from '../indexing/git.service.js';

const IMPORT_RE = /(?:from\s+|import\s*\(\s*|import\s+)['"](\.[^'"]+)['"]/g;
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];

export type ImportGraph = { imports: Map<string, Set<string>>; importedBy: Map<string, Set<string>> };

// files: repo-relative POSIX paths; read(file) returns its source text.
export function buildImportGraph(files: string[], read: (file: string) => string): ImportGraph {
  const known = new Set(files);
  const imports = new Map<string, Set<string>>();
  const importedBy = new Map<string, Set<string>>();
  for (const file of files) {
    const found = new Set<string>();
    for (const m of read(file).matchAll(IMPORT_RE)) {
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])).replace(/\.(js|jsx|ts|tsx)$/, '');
      const hit = EXTENSIONS.map((ext) => base + ext).find((c) => known.has(c));
      if (hit && hit !== file) found.add(hit);
    }
    imports.set(file, found);
    for (const to of found) {
      if (!importedBy.has(to)) importedBy.set(to, new Set());
      importedBy.get(to)!.add(file);
    }
  }
  return { imports, importedBy };
}

export function importNeighbors(graph: ImportGraph, files: string[]): string[] {
  const out = new Set<string>();
  for (const f of files) {
    for (const n of graph.imports.get(f) ?? []) out.add(n);
    for (const n of graph.importedBy.get(f) ?? []) out.add(n);
  }
  for (const f of files) out.delete(f);
  return [...out].sort();
}

// Same file set the loader indexes.
const graphCache = new Map<string, ImportGraph>();
export function snapshotImportGraph(repoId: string, commitSha: string): ImportGraph | null {
  const root = snapshotPath(repoId, commitSha);
  if (graphCache.has(root)) return graphCache.get(root)!;
  if (!fs.existsSync(root)) return null;
  const files = glob
    .sync('**/*.{ts,tsx,js,jsx}', { cwd: root, ignore: ['**/node_modules/**', '**/dist/**'], posix: true })
    .map((f) => f.split(path.sep).join('/'));
  const graph = buildImportGraph(files, (f) => fs.readFileSync(path.join(root, f), 'utf8'));
  graphCache.set(root, graph);
  return graph;
}

// Hosts with ephemeral disks lose snapshots on restart. Start one background clone per missing snapshot so
// later queries get the import graph; the current query expands same-file only.
const pendingClones = new Map<string, Promise<unknown>>();
export function ensureSnapshotInBackground(repoUrl: string, repoId: string, commitSha: string): void {
  const root = snapshotPath(repoId, commitSha);
  if (fs.existsSync(root) || pendingClones.has(root)) return;
  const clone = cloneRepo(repoUrl, commitSha)
    .catch((err) => console.error(`Background snapshot clone failed for ${repoId}@${commitSha}:`, err))
    .finally(() => pendingClones.delete(root));
  pendingClones.set(root, clone);
}

export const docKey = (d: Document) => `${d.metadata?.filePath}:${d.metadata?.startLine}-${d.metadata?.endLine}`;

export const dedupeDocs = (docs: Document[]) => [...new Map(docs.map((d) => [docKey(d), d])).values()];

// The files whose chunks expansion adds: the top files themselves plus their import neighbors.
export function expansionFiles(topDocs: Document[], graph: ImportGraph | null): string[] {
  const topFiles = [...new Set(topDocs.map((d) => String(d.metadata?.filePath ?? '')).filter(Boolean))];
  return [...new Set([...topFiles, ...(graph ? importNeighbors(graph, topFiles) : [])])];
}
