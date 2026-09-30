// Collects evidence from any tool (and from retrieval) under stable E-ids, so the existing
// deterministic citation layer can resolve model references against all of it.
import {
  assembleCitations,
  formatEvidence,
  snapshotSourceRoot,
  type Citation,
  type CitationDiagnostics,
  type Evidence,
  type EvidenceReference,
} from '../queries/evidence.js';
import type { RepoSnapshot } from './snapshot.js';
import type { ToolEvidence, ToolResult } from './types.js';

type SourceRootResolver = (ev: Evidence) => string | null;

const keyOf = (e: Omit<Evidence, 'id'>) =>
  `${e.repoId}@${e.commitSha ?? '-'}:${e.filePath}:${e.startLine}-${e.endLine}`;

export class EvidenceStore {
  private items: Evidence[] = [];
  private byKey = new Map<string, Evidence>();

  constructor(private resolveSourceRoot: SourceRootResolver = snapshotSourceRoot) {}

  // Citations for evidence from this snapshot are read from its root, wherever it lives.
  static forSnapshot(snapshot: RepoSnapshot): EvidenceStore {
    return new EvidenceStore((ev) =>
      ev.repoId === snapshot.repoId && ev.commitSha === snapshot.commitSha
        ? snapshot.root
        : snapshotSourceRoot(ev),
    );
  }

  // Returns the stored items in input order; an identical range already stored keeps its original ID.
  add(evidence: Array<ToolEvidence | Omit<Evidence, 'id'>>): Evidence[] {
    return evidence.map((e) => {
      const key = keyOf(e);
      const existing = this.byKey.get(key);
      if (existing) return existing;
      const stored: Evidence = { ...e, id: `E${this.items.length + 1}` };
      this.items.push(stored);
      this.byKey.set(key, stored);
      return stored;
    });
  }

  addResult(result: ToolResult): Evidence[] {
    return this.add(result.evidence);
  }

  get(id: string): Evidence | undefined {
    return this.items.find((e) => e.id === id);
  }

  all(): Evidence[] {
    return [...this.items];
  }

  format(items: Evidence[] = this.items): string {
    return items.map((e) => formatEvidence(e, e.label)).join('\n');
  }

  cite(refs: EvidenceReference[]): { citations: Citation[]; diagnostics: CitationDiagnostics } {
    return assembleCitations(refs, this.items, this.resolveSourceRoot);
  }
}
