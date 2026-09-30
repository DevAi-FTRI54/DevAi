import picomatch from 'picomatch';
import { ToolError, type ToolName } from './types.js';

// Glob(s) over repo-relative paths; patterns without "/" match file names anywhere.
export function includeFilter(include: string | string[] | undefined, tool: ToolName): (file: string) => boolean {
  const globs = include === undefined ? [] : Array.isArray(include) ? include : [include];
  if (globs.some((g) => typeof g !== 'string' || !g.trim())) {
    throw new ToolError('INVALID_INPUT', 'include must be a non-empty glob or list of globs', tool);
  }
  if (globs.length === 0) return () => true;
  const matchers = globs.map((g) => picomatch(g.trim(), { dot: true, basename: !g.includes('/') }));
  return (file) => matchers.some((m) => m(file));
}

export function boundedInt(
  value: unknown,
  name: string,
  fallback: number,
  min: number,
  max: number,
  tool: ToolName,
): number {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new ToolError('INVALID_INPUT', `${name} must be an integer from ${min} to ${max}`, tool);
  }
  return value as number;
}

// Merges sorted hit lines into non-overlapping context windows: [start, end, hits].
export function contextWindows(
  hitLines: number[],
  context: number,
  totalLines: number,
): Array<[number, number, number[]]> {
  const out: Array<[number, number, number[]]> = [];
  for (const line of hitLines) {
    const start = Math.max(1, line - context);
    const end = Math.min(totalLines, line + context);
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

export const linesLabel = (prefix: string, lines: number[]) =>
  `${prefix} at line${lines.length > 1 ? 's' : ''} ${lines.join(', ')}`;
