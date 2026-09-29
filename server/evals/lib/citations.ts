import { readRepoLines, normalizeWs } from './repoFiles.js';
import type { ContextDoc } from './metrics.js';

export interface Citation {
  file: string;
  startLine: number;
  endLine: number;
  snippet: string;
}

export interface CitationCheck {
  file: string;
  startLine: number;
  endLine: number;
  exists: boolean;
  inRange: boolean;
  snippetMatch: boolean;
  grounded: boolean;
  relevant: boolean;
  valid: boolean;
}

const SLACK = 3;
const SNIPPET_LINE_THRESHOLD = 0.8;

export const normalizePath = (p: string) =>
  p.replace(/\\/g, '/').replace(/^\.?\//, '').trim();

// `//` must follow whitespace or line start so URLs like https://... survive.
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, '$1');
const compact = (s: string) => stripComments(s).replace(/\s+/g, '');
const ELLIPSIS = /^\s*(\.\.\.|…)\s*|\s*(\.\.\.|…)\s*$/g;

// Models elide ("..."), reflow, and drop comments from snippets, so compare comment- and whitespace-free text,
// and require most non-trivial snippet lines to appear in the cited window.
function snippetMatches(snippet: string, window: string): boolean {
  const haystack = compact(window);
  const lines = snippet
    .split('\n')
    .map((l) => compact(l.replace(ELLIPSIS, '')))
    .filter((l) => l.length >= 4);
  if (lines.length === 0) return false;
  const found = lines.filter((l) => haystack.includes(l)).length;
  return found / lines.length >= SNIPPET_LINE_THRESHOLD;
}

const overlaps = (a: [number, number], b: [number, number]) =>
  a[0] <= b[1] && b[0] <= a[1];

export function checkCitation(
  c: Citation,
  root: string,
  context: ContextDoc[],
  expectedFiles: Set<string>,
): CitationCheck {
  const file = normalizePath(c.file ?? '');
  const lines = file ? readRepoLines(root, file) : null;
  const exists = lines !== null;
  const inRange =
    exists &&
    Number.isInteger(c.startLine) &&
    Number.isInteger(c.endLine) &&
    c.startLine >= 1 &&
    c.startLine <= c.endLine &&
    c.endLine <= lines!.length;

  let snippetMatch = false;
  if (inRange && c.snippet) {
    const from = Math.max(1, c.startLine - SLACK);
    const to = Math.min(lines!.length, c.endLine + SLACK);
    snippetMatch = snippetMatches(c.snippet, lines!.slice(from - 1, to).join('\n'));
  }

  const grounded = context.some(
    (d) =>
      normalizePath(d.filePath) === file &&
      overlaps([d.spanStart, d.spanEnd], [c.startLine, c.endLine]),
  );

  return {
    file,
    startLine: c.startLine,
    endLine: c.endLine,
    exists,
    inRange,
    snippetMatch,
    grounded,
    relevant: expectedFiles.has(file),
    valid: exists && inRange && snippetMatch,
  };
}
