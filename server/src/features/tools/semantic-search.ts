// The v2.1 retrieval pipeline (MultiQuery over Qdrant MMR, then Cohere rerank) exposed as a tool whose
// results are checked against the pinned snapshot and re-read from it.
import type { Document } from '@langchain/core/documents';
import { buildEvidence } from '../queries/evidence.js';
import { cohereApiKey } from '../../config/cohere.js';
import type { RepoSnapshot } from './snapshot.js';
import { ToolError, type ToolEvidence, type ToolResult } from './types.js';

export type SemanticSearchInput = {
  query: string;
  // Maximum evidence items returned (after reranking).
  k?: number;
};

export type SemanticRetriever = (query: string, repoId: string) => Promise<Document[]>;

const RETRIEVE_K = 8;
const RERANK_TOP_N = 5;
const MAX_K = 8;

// Same parameters as the retrieve and rerank nodes in rag.service.ts. Imported lazily so the tool
// module loads without model or vector-store configuration.
export const defaultSemanticRetriever: SemanticRetriever = async (query, repoId) => {
  const { createCodeRetriever } = await import('../indexing/vector.service.js');
  const docs = await (await createCodeRetriever(repoId, RETRIEVE_K)).invoke(query);
  const apiKey = cohereApiKey();
  if (!docs.length || !apiKey) return docs;
  try {
    const { CohereRerank } = await import('@langchain/cohere');
    const reranker = new CohereRerank({
      apiKey,
      model: 'rerank-v3.5',
      topN: Math.min(RERANK_TOP_N, docs.length),
    });
    const ranks = await reranker.rerank(docs, query);
    return ranks.map((r: { index: number }) => docs[r.index]);
  } catch {
    return docs;
  }
};

const squash = (s: string) => s.replace(/\s+/g, '');

export async function semanticSearch(
  snapshot: RepoSnapshot,
  input: SemanticSearchInput,
  retrieve: SemanticRetriever = defaultSemanticRetriever,
): Promise<ToolResult> {
  if (typeof input?.query !== 'string' || !input.query.trim()) {
    throw new ToolError('INVALID_INPUT', 'query is required', 'semanticSearch');
  }
  const k = input.k ?? MAX_K;
  if (!Number.isInteger(k) || k < 1 || k > MAX_K) {
    throw new ToolError('INVALID_INPUT', `k must be an integer from 1 to ${MAX_K}`, 'semanticSearch');
  }

  let docs: Document[];
  try {
    docs = await retrieve(input.query, snapshot.repoId);
  } catch (err) {
    throw new ToolError('UNAVAILABLE', `Retrieval failed: ${(err as Error)?.message ?? err}`, 'semanticSearch');
  }

  const dropped = { otherCommit: 0, notInSnapshot: 0, unverified: 0 };
  const seen = new Set<string>();
  const evidence: ToolEvidence[] = [];
  for (const ev of buildEvidence(docs, snapshot.repoId)) {
    if (ev.repoId !== snapshot.repoId || (ev.commitSha && ev.commitSha !== snapshot.commitSha)) {
      dropped.otherCommit++;
      continue;
    }
    if (!snapshot.hasFile(ev.filePath)) {
      dropped.notInSnapshot++;
      continue;
    }
    const pinned = snapshot.evidence(ev.filePath, ev.startLine, ev.endLine, 'semanticSearch', ev.label);
    // Without a recorded commit the indexed text must match the snapshot to be trusted.
    if (!ev.commitSha && squash(pinned.content) !== squash(ev.content)) {
      dropped.unverified++;
      continue;
    }
    const key = `${pinned.filePath}:${pinned.startLine}-${pinned.endLine}`;
    if (seen.has(key)) continue;
    seen.add(key);
    evidence.push(pinned);
  }

  const truncated = evidence.length > k;
  const parts = [`${Math.min(evidence.length, k)} of ${docs.length} retrieved chunks`];
  if (dropped.otherCommit) parts.push(`${dropped.otherCommit} from another commit dropped`);
  if (dropped.notInSnapshot) parts.push(`${dropped.notInSnapshot} not in snapshot dropped`);
  if (dropped.unverified) parts.push(`${dropped.unverified} unverifiable legacy chunks dropped`);
  return {
    tool: 'semanticSearch',
    evidence: evidence.slice(0, k),
    truncated,
    note: `${parts.join('; ')}.`,
  };
}
