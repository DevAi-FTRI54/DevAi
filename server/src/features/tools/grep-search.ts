import { boundedInt, contextWindows, includeFilter, linesLabel } from './matching.js';
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

export async function grepSearch(snapshot: RepoSnapshot, input: GrepSearchInput): Promise<ToolResult> {
  const re = compile(input);
  const included = includeFilter(input.include, 'grepSearch');
  const maxResults = boundedInt(input.maxResults, 'maxResults', GREP_DEFAULT_MAX_RESULTS, 1, GREP_MAX_RESULTS_LIMIT, 'grepSearch');
  const context = boundedInt(input.contextLines, 'contextLines', GREP_DEFAULT_CONTEXT, 0, MAX_CONTEXT, 'grepSearch');

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
    for (const [start, end, at] of contextWindows(hits, context, lines.length)) {
      evidence.push(snapshot.evidence(file, start, end, 'grepSearch', linesLabel('match', at)));
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
