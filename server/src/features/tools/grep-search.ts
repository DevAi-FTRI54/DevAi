import picomatch from 'picomatch';
import type { RepoSnapshot } from './snapshot.js';
import { ToolError, type ToolEvidence, type ToolResult } from './types.js';

export type GrepSearchInput = {
  pattern: string;
  // Treat pattern as a JavaScript regular expression instead of a literal string.
  regex?: boolean;
  caseSensitive?: boolean;
  // Glob(s) over repo-relative paths, e.g. "src/**/*.ts". Patterns without "/" match file names anywhere.
  include?: string | string[];
  // Maximum matching lines returned.
  maxResults?: number;
  contextLines?: number;
};

export const GREP_DEFAULT_MAX_RESULTS = 50;
export const GREP_MAX_RESULTS_LIMIT = 200;
export const GREP_DEFAULT_CONTEXT = 2;
const MAX_CONTEXT = 10;
const MAX_PATTERN_LENGTH = 500;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const boundedInt = (value: unknown, name: string, fallback: number, min: number, max: number) => {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new ToolError('INVALID_INPUT', `${name} must be an integer from ${min} to ${max}`, 'grepSearch');
  }
  return value as number;
};

function compile(input: GrepSearchInput): RegExp {
  if (typeof input?.pattern !== 'string' || input.pattern.length === 0) {
    throw new ToolError('INVALID_INPUT', 'pattern is required', 'grepSearch');
  }
  if (input.pattern.length > MAX_PATTERN_LENGTH) {
    throw new ToolError('INVALID_INPUT', `pattern is longer than ${MAX_PATTERN_LENGTH} characters`, 'grepSearch');
  }
  const source = input.regex ? input.pattern : escapeRegExp(input.pattern);
  try {
    return new RegExp(source, input.caseSensitive ? '' : 'i');
  } catch (err) {
    throw new ToolError('INVALID_INPUT', `Invalid regular expression: ${(err as Error).message}`, 'grepSearch');
  }
}

function includeFilter(include: GrepSearchInput['include']): (file: string) => boolean {
  const globs = include === undefined ? [] : Array.isArray(include) ? include : [include];
  if (globs.some((g) => typeof g !== 'string' || !g.trim())) {
    throw new ToolError('INVALID_INPUT', 'include must be a non-empty glob or list of globs', 'grepSearch');
  }
  if (globs.length === 0) return () => true;
  const matchers = globs.map((g) => picomatch(g.trim(), { dot: true, basename: !g.includes('/') }));
  return (file) => matchers.some((m) => m(file));
}

// Merges each file's matches into non-overlapping context windows, one evidence item per window.
function windows(matchLines: number[], context: number, total: number): Array<[number, number, number[]]> {
  const out: Array<[number, number, number[]]> = [];
  for (const line of matchLines) {
    const start = Math.max(1, line - context);
    const end = Math.min(total, line + context);
    const last = out[out.length - 1];
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
      last[2].push(line);
    } else {
      out.push([start, end, [line]]);
    }
  }
  return out;
}

export async function grepSearch(snapshot: RepoSnapshot, input: GrepSearchInput): Promise<ToolResult> {
  const re = compile(input);
  const included = includeFilter(input.include);
  const maxResults = boundedInt(input.maxResults, 'maxResults', GREP_DEFAULT_MAX_RESULTS, 1, GREP_MAX_RESULTS_LIMIT);
  const context = boundedInt(input.contextLines, 'contextLines', GREP_DEFAULT_CONTEXT, 0, MAX_CONTEXT);

  const evidence: ToolEvidence[] = [];
  let matched = 0;
  let files = 0;
  let truncated = false;

  scan: for (const file of snapshot.listFiles()) {
    if (!included(file)) continue;
    const lines = snapshot.readLines(file);
    const hits: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (!re.test(lines[i])) continue;
      if (matched === maxResults) {
        truncated = true;
        if (hits.length) break;
        break scan;
      }
      hits.push(i + 1);
      matched++;
    }
    if (!hits.length) continue;
    files++;
    for (const [start, end, at] of windows(hits, context, lines.length)) {
      evidence.push(
        snapshot.evidence(file, start, end, 'grepSearch', `match at line${at.length > 1 ? 's' : ''} ${at.join(', ')}`),
      );
    }
    if (truncated) break;
  }

  const summary = `${matched} matching line${matched === 1 ? '' : 's'} in ${files} file${files === 1 ? '' : 's'}`;
  return {
    tool: 'grepSearch',
    evidence,
    truncated,
    note: truncated ? `${summary}; stopped at maxResults=${maxResults}.` : `${summary}.`,
  };
}
