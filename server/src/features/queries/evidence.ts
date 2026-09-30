// Deterministic evidence layer: the model cites evidence IDs and line ranges; the server builds every citation
// (file, lines, snippet) from source text (a local clone when available, otherwise the indexed text),
// so no model-written snippet reaches the client.
import fs from 'fs';
import path from 'path';
import { Document } from '@langchain/core/documents';

export type Evidence = {
  id: string;
  repoId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
};

export type EvidenceReference = {
  evidenceId: string;
  startLine: number;
  endLine: number;
};

export type Citation = {
  evidenceId: string;
  file: string;
  startLine: number;
  endLine: number;
  snippet: string;
};

export type CitationDiagnostics = {
  requested: number;
  emitted: number;
  unknownEvidence: number;
  missingFile: number;
  clamped: number;
  fullEvidenceFallback: number;
  // Range selected only blank lines: replaced by the whole evidence item (or dropped if that is blank too).
  whitespaceFallback: number;
  emptyEvidence: number;
  duplicates: number;
};

const contentLines = (content: string) => {
  const lines = content.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
};

// Declarations index getFullText(), which starts at textStartLine (leading trivia), not at startLine.
// Chunk text starts at startLine; older indexes also copied the parent's textStartLine onto chunks.
export function buildEvidence(docs: Document[], repoId: string): Evidence[] {
  return docs.map((d, i) => {
    const m = d.metadata;
    const startLine = Number((m.chunked ? m.startLine : m.textStartLine ?? m.startLine) ?? 1);
    const content = d.pageContent ?? '';
    return {
      id: `E${i + 1}`,
      repoId: String(d.metadata.repoId ?? repoId),
      filePath: String(d.metadata.filePath ?? ''),
      startLine,
      endLine: startLine + contentLines(content).length - 1,
      content,
    };
  });
}

export function formatEvidence(e: Evidence, name?: string): string {
  const width = String(e.endLine).length;
  const body = contentLines(e.content)
    .map((line, i) => `${String(e.startLine + i).padStart(width)}| ${line}`)
    .join('\n');
  const header = name ? `[${e.id}] NAME: ${name}\nFILE: ` : `[${e.id}] FILE: `;
  return `${header}${e.filePath} (lines ${e.startLine}-${e.endLine})\n---\n${body}\n====\n`;
}

// Production clones live at .cache/repos/<repoId>/<sha>; only trust one when it is unambiguous.
export function localSourceRoot(repoId: string): string | null {
  const dir = path.resolve('.cache', 'repos', repoId);
  try {
    const shas = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory());
    return shas.length === 1 ? path.join(dir, shas[0].name) : null;
  } catch {
    return null;
  }
}

const normalizeId = (id: string) => String(id ?? '').trim().replace(/^\[|\]$/g, '').toUpperCase();

export function assembleCitations(
  refs: EvidenceReference[],
  evidence: Evidence[],
  sourceRoot: string | null = null,
): { citations: Citation[]; diagnostics: CitationDiagnostics } {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const diagnostics: CitationDiagnostics = {
    requested: refs.length,
    emitted: 0,
    unknownEvidence: 0,
    missingFile: 0,
    clamped: 0,
    fullEvidenceFallback: 0,
    whitespaceFallback: 0,
    emptyEvidence: 0,
    duplicates: 0,
  };
  // undefined: no local clone to check against; null: the file is not in the clone.
  const fileCache = new Map<string, string[] | null>();
  const sourceFileLines = (filePath: string): string[] | null | undefined => {
    if (!sourceRoot) return undefined;
    if (!fileCache.has(filePath)) {
      const abs = path.resolve(sourceRoot, filePath);
      const inside = abs.startsWith(path.resolve(sourceRoot) + path.sep);
      fileCache.set(
        filePath,
        inside && fs.existsSync(abs) ? contentLines(fs.readFileSync(abs, 'utf8')) : null,
      );
    }
    return fileCache.get(filePath);
  };

  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const ref of refs) {
    const ev = byId.get(normalizeId(ref.evidenceId));
    if (!ev) {
      diagnostics.unknownEvidence++;
      continue;
    }
    const fileLines = sourceFileLines(ev.filePath);
    if (!ev.filePath || fileLines === null) {
      diagnostics.missingFile++;
      continue;
    }
    const maxLine = Math.min(ev.endLine, fileLines?.length ?? ev.endLine);

    let start = Math.round(Number(ref.startLine));
    let end = Math.round(Number(ref.endLine));
    if (!Number.isFinite(start) || !Number.isFinite(end)) start = end = NaN;
    if (start > end) [start, end] = [end, start];
    if (!(start <= maxLine && end >= ev.startLine)) {
      start = ev.startLine;
      end = maxLine;
      diagnostics.fullEvidenceFallback++;
    } else if (start < ev.startLine || end > maxLine) {
      start = Math.max(start, ev.startLine);
      end = Math.min(end, maxLine);
      diagnostics.clamped++;
    }

    // Indexed text can lose the first line's indentation (splitter trimming, declaration leading trivia),
    // so copy from the source file when a clone is available.
    const evidenceLines = contentLines(ev.content);
    const at = (line: number) =>
      fileLines ? (fileLines[line - 1] ?? '') : (evidenceLines[line - ev.startLine] ?? '');
    const trimBlankEdges = () => {
      while (start < end && at(start).trim() === '') start++;
      while (end > start && at(end).trim() === '') end--;
    };
    trimBlankEdges();
    if (at(start).trim() === '') {
      start = ev.startLine;
      end = maxLine;
      trimBlankEdges();
      if (at(start).trim() === '') {
        diagnostics.emptyEvidence++;
        continue;
      }
      diagnostics.whitespaceFallback++;
    }

    const key = `${ev.filePath}:${start}-${end}`;
    if (seen.has(key)) {
      diagnostics.duplicates++;
      continue;
    }
    seen.add(key);
    citations.push({
      evidenceId: ev.id,
      file: ev.filePath,
      startLine: start,
      endLine: end,
      snippet: Array.from({ length: end - start + 1 }, (_, k) => at(start + k)).join('\n'),
    });
  }
  diagnostics.emitted = citations.length;
  return { citations, diagnostics };
}
