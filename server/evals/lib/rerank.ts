// Both pipelines swallow Cohere errors and fall back to the unranked pool, which silently changes what the
// answer model sees. Evals check the reranker up front and detect fallbacks per row instead.
import type { AgentTrace } from '../../src/features/agent/types.js';

// Must match the rerank topN in rag.service.ts and tools/semantic-search.ts.
export const RERANK_TOP_N = 5;

export async function preflightRerank(apiKey: string | undefined): Promise<string | null> {
  if (!apiKey) return 'COHERE_API_KEY is not set';
  try {
    const res = await fetch('https://api.cohere.com/v2/rerank', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'rerank-v3.5', query: 'preflight', documents: ['a', 'b'], top_n: 1 }),
    });
    if (res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    return `Cohere rerank returned ${res.status}${body.message ? `: ${body.message}` : ''}`;
  } catch (err) {
    return `Cohere rerank request failed: ${(err as Error)?.message ?? err}`;
  }
}

// A reranked result never has more than RERANK_TOP_N chunks; more means the unranked pool was used.
export function ragRerankFellBack(contextSize: number): boolean {
  return contextSize > RERANK_TOP_N;
}

// semanticSearch notes "<shown> of <n> retrieved chunks", where n is the post-rerank count.
export function agentRerankFallbacks(trace: Pick<AgentTrace, 'steps'> | null): { searches: number; fallbacks: number } {
  let searches = 0;
  let fallbacks = 0;
  for (const s of trace?.steps ?? []) {
    if (s.tool !== 'semanticSearch' || s.status !== 'ok') continue;
    searches++;
    const n = Number(/of (\d+) retrieved chunks/.exec(s.note ?? '')?.[1]);
    if (n > RERANK_TOP_N) fallbacks++;
  }
  return { searches, fallbacks };
}
