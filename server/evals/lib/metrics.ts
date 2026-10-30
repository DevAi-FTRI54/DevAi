import type { GoldenItem } from './golden.js';
import type { CitationCheck } from './citations.js';
import { normalizePath } from './citations.js';

export interface ContextDoc {
  filePath: string;
  // Line range from metadata, i.e. what the model is shown.
  startLine: number;
  endLine: number;
  // Real line span of the text (differs from startLine/endLine only for legacy chunks).
  spanStart: number;
  spanEnd: number;
  chunked: boolean;
  declarationName?: string;
}

export function toContextDoc(d: {
  metadata?: Record<string, any>;
}): ContextDoc {
  const m = d.metadata ?? {};
  const startLine = Number(m.startLine ?? 0);
  const endLine = Number(m.endLine ?? 0);
  const loc = m.loc?.lines as { from?: number; to?: number } | undefined;
  // Indexes built before RAG v1 store chunk-relative loc.lines with the parent's range; newer ones store absolute lines.
  const legacyChunk = !!loc && typeof loc.from === 'number' && typeof loc.to === 'number';
  return {
    filePath: String(m.filePath ?? ''),
    startLine,
    endLine,
    spanStart: legacyChunk ? startLine + loc!.from! - 1 : startLine,
    spanEnd: legacyChunk ? startLine + loc!.to! - 1 : endLine,
    chunked: legacyChunk || m.chunked === true,
    declarationName: m.declarationName,
  };
}

// Agent evidence already carries absolute, exact line ranges.
export function evidenceToContextDoc(e: {
  filePath: string;
  startLine: number;
  endLine: number;
  label?: string;
}): ContextDoc {
  return {
    filePath: e.filePath,
    startLine: e.startLine,
    endLine: e.endLine,
    spanStart: e.startLine,
    spanEnd: e.endLine,
    chunked: false,
    declarationName: e.label,
  };
}

// A doc "localizes" an expected range if it overlaps it and is not much bigger than it (whole-file docs overlap everything).
const MIN_TIGHT_SPAN = 60;
const localizes = (d: ContextDoc, range: [number, number]) =>
  overlaps([d.spanStart, d.spanEnd], range) &&
  d.spanEnd - d.spanStart + 1 <= Math.max(MIN_TIGHT_SPAN, 2 * (range[1] - range[0] + 1));

export interface RetrievalMetrics {
  fileRecall: number;
  anyHit: boolean;
  rangeHit: boolean;
  requiredRangeRecall: number;
  retrievedFiles: string[];
  missingRequiredFiles: string[];
}

export interface CitationMetrics {
  count: number;
  validRate: number | null;
  existsRate: number | null;
  inRangeRate: number | null;
  snippetMatchRate: number | null;
  groundedRate: number | null;
  relevantRate: number | null;
}

const overlaps = (a: [number, number], b: [number, number]) =>
  a[0] <= b[1] && b[0] <= a[1];

export function retrievalMetrics(
  item: GoldenItem,
  context: ContextDoc[],
): RetrievalMetrics {
  const retrievedFiles = [...new Set(context.map((d) => normalizePath(d.filePath)))];
  const retrieved = new Set(retrievedFiles);
  const required = item.expected_sources.filter((s) => s.required);
  const requiredFiles = [...new Set(required.map((s) => s.file))];
  const allFiles = new Set(item.expected_sources.map((s) => s.file));

  const missingRequiredFiles = requiredFiles.filter((f) => !retrieved.has(f));
  const rangeHitFor = (s: GoldenItem['expected_sources'][number]) =>
    !!s.lines &&
    context.some(
      (d) => normalizePath(d.filePath) === s.file && localizes(d, s.lines!),
    );
  const requiredWithLines = required.filter((s) => s.lines);

  return {
    fileRecall: requiredFiles.length
      ? (requiredFiles.length - missingRequiredFiles.length) / requiredFiles.length
      : 0,
    anyHit: [...allFiles].some((f) => retrieved.has(f)),
    rangeHit: item.expected_sources.some(rangeHitFor),
    requiredRangeRecall: requiredWithLines.length
      ? requiredWithLines.filter(rangeHitFor).length / requiredWithLines.length
      : 0,
    retrievedFiles,
    missingRequiredFiles,
  };
}

const rate = (checks: CitationCheck[], key: keyof CitationCheck) =>
  checks.length ? checks.filter((c) => c[key] === true).length / checks.length : null;

export function citationMetrics(checks: CitationCheck[]): CitationMetrics {
  return {
    count: checks.length,
    validRate: rate(checks, 'valid'),
    existsRate: rate(checks, 'exists'),
    inRangeRate: rate(checks, 'inRange'),
    snippetMatchRate: rate(checks, 'snippetMatch'),
    groundedRate: rate(checks, 'grounded'),
    relevantRate: rate(checks, 'relevant'),
  };
}

export const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

export function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}
