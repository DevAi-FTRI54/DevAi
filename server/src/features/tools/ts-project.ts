// A ts-morph project built from a snapshot's own file text (in memory), so syntax positions line up
// exactly with RepoSnapshot line numbers. Built once per snapshot.
import { Project, ts, type SourceFile } from 'ts-morph';
import type { RepoSnapshot } from './snapshot.js';

const CODE_FILE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

const projects = new WeakMap<RepoSnapshot, Project>();

export function snapshotProject(snapshot: RepoSnapshot): Project {
  let project = projects.get(snapshot);
  if (project) return project;
  project = new Project({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true, jsx: ts.JsxEmit.Preserve },
  });
  for (const file of snapshot.listFiles()) {
    if (!CODE_FILE.test(file) || file.endsWith('.d.ts')) continue;
    project.createSourceFile(`/${file}`, snapshot.readLines(file).join('\n'));
  }
  projects.set(snapshot, project);
  return project;
}

export const repoPath = (sf: SourceFile) => sf.getFilePath().replace(/^\//, '');

// Source files in the snapshot's sorted order.
export function sourceFiles(snapshot: RepoSnapshot): SourceFile[] {
  return snapshotProject(snapshot)
    .getSourceFiles()
    .sort((a, b) => (repoPath(a) < repoPath(b) ? -1 : repoPath(a) > repoPath(b) ? 1 : 0));
}
