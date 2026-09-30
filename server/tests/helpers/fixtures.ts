import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

export function tempDir(prefix = 'devai-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function writeFiles(root: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
}

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  }).trim();

// A local git repository usable as a clone URL; returns helpers to add commits.
export function gitFixture(files: Record<string, string>) {
  const root = tempDir('devai-origin-');
  git(root, 'init', '-q', '-b', 'main');
  writeFiles(root, files);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'initial');
  return {
    url: root,
    head: () => git(root, 'rev-parse', 'HEAD'),
    commit(more: Record<string, string>, message = 'change') {
      writeFiles(root, more);
      git(root, 'add', '-A');
      git(root, 'commit', '-q', '-m', message);
      return git(root, 'rev-parse', 'HEAD');
    },
    branch: (name: string) => git(root, 'branch', name),
    tag: (name: string) => git(root, 'tag', name),
  };
}
