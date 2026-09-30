import type { RepoSnapshot } from './snapshot.js';
import { ToolError, type ToolResult } from './types.js';

export type ReadFileInput = {
  path: string;
  // 1-based, inclusive. Defaults to the whole file, capped at READ_FILE_MAX_LINES.
  startLine?: number;
  endLine?: number;
};

export const READ_FILE_MAX_LINES = 400;

const lineArg = (value: unknown, name: string): number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new ToolError('INVALID_INPUT', `${name} must be a positive integer`, 'readFile');
  }
  return value as number;
};

export async function readFile(snapshot: RepoSnapshot, input: ReadFileInput): Promise<ToolResult> {
  if (typeof input?.path !== 'string') {
    throw new ToolError('INVALID_INPUT', 'path is required', 'readFile');
  }
  const requestedStart = lineArg(input.startLine, 'startLine');
  const requestedEnd = lineArg(input.endLine, 'endLine');
  if (requestedStart && requestedEnd && requestedStart > requestedEnd) {
    throw new ToolError('INVALID_INPUT', 'startLine must not be after endLine', 'readFile');
  }

  const total = snapshot.readLines(input.path).length;
  const start = requestedStart ?? 1;
  if (start > total) {
    throw new ToolError('INVALID_INPUT', `startLine ${start} is past the end of the file (${total} lines)`, 'readFile');
  }
  const wanted = Math.min(requestedEnd ?? total, total);
  const end = Math.min(wanted, start + READ_FILE_MAX_LINES - 1);
  const truncated = end < wanted;

  return {
    tool: 'readFile',
    evidence: [snapshot.evidence(input.path, start, end, 'readFile')],
    truncated,
    note: truncated
      ? `Showing lines ${start}-${end} of ${total}; continue with startLine ${end + 1}.`
      : `Lines ${start}-${end} of ${total}.`,
  };
}
