import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export type Category =
  | 'exact_lookup'
  | 'conceptual'
  | 'cross_file'
  | 'dependency_tracing'
  | 'configuration'
  | 'multi_part';

export interface ExpectedSource {
  file: string;
  symbol?: string;
  lines?: [number, number];
  required: boolean;
}

export interface GoldenItem {
  id: string;
  category: Category;
  question: string;
  type: string;
  expected_sources: ExpectedSource[];
  key_facts: string[];
}

export interface GoldenSet {
  name: string;
  repoUrl: string;
  sha: string;
  repoId: string;
  items: GoldenItem[];
}

export const EVALS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

export const DEFAULT_GOLDEN = path.join(
  EVALS_DIR,
  'golden',
  'devai-625d687.json',
);

export function loadGolden(file = DEFAULT_GOLDEN): GoldenSet {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as GoldenSet;
}

export function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
