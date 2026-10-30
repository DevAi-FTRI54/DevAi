// One reranker for every pipeline. Cohere rerank scores each (query, document) pair independently, so
// scores can be cached per pair and a ranking of any document set rebuilt from them. The cache is off unless
// a caller installs one (the eval harness does, so repeated runs over a frozen index cost no API calls).
import crypto from 'node:crypto';
import fs from 'fs';
import path from 'path';
import type { Document } from '@langchain/core/documents';
import { cohereApiKey, COHERE_KEY_VAR } from '../../config/cohere.js';

export const RERANK_MODEL = 'rerank-v3.5';

// Returns one relevance score per document, in input order.
export type RerankScorer = (query: string, docs: Document[]) => Promise<number[]>;

export const cohereScorer: RerankScorer = async (query, docs) => {
  const apiKey = cohereApiKey();
  if (!apiKey) throw new Error(`${COHERE_KEY_VAR} is missing`);
  const { CohereRerank } = await import('@langchain/cohere');
  const reranker = new CohereRerank({ apiKey, model: RERANK_MODEL });
  const ranks: { index: number; relevanceScore: number }[] = await reranker.rerank(docs, query, { topN: docs.length });
  const scores = new Array<number>(docs.length).fill(-Infinity);
  for (const r of ranks) scores[r.index] = r.relevanceScore;
  return scores;
};

let scorer: RerankScorer = cohereScorer;
let cache: { file: string | null; scores: Map<string, number> } | null = null;

export const rerankStats = { apiCalls: 0, failures: 0, cachedScores: 0, newScores: 0 };

export function setRerankScorer(next: RerankScorer | null): void {
  scorer = next ?? cohereScorer;
}

// file = null keeps the cache in memory only.
export function installRerankCache(file: string | null): void {
  const scores = new Map<string, number>();
  if (file && fs.existsSync(file)) {
    for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, number>)) scores.set(k, v);
  }
  cache = { file, scores };
}

export function uninstallRerankCache(): void {
  cache = null;
}

const pairKey = (query: string, d: Document) =>
  crypto
    .createHash('sha256')
    .update(`${RERANK_MODEL}\0${query}\0${d.metadata?.filePath ?? ''}:${d.metadata?.startLine ?? ''}-${d.metadata?.endLine ?? ''}\0${d.pageContent}`)
    .digest('hex');

// Scores every document (cached pairs are not re-sent) and returns them ranked, best first. Throws if scoring fails.
export async function rankDocuments(docs: Document[], query: string): Promise<{ doc: Document; score: number }[]> {
  if (!docs.length) return [];
  const keys = docs.map((d) => pairKey(query, d));
  const scores = keys.map((k) => cache?.scores.get(k));
  const missing = scores.flatMap((s, i) => (s === undefined ? [i] : []));
  rerankStats.cachedScores += docs.length - missing.length;
  if (missing.length) {
    rerankStats.apiCalls++;
    let fresh: number[];
    try {
      fresh = await scorer(query, missing.map((i) => docs[i]));
    } catch (err) {
      rerankStats.failures++;
      throw err;
    }
    rerankStats.newScores += missing.length;
    missing.forEach((docIndex, j) => {
      scores[docIndex] = fresh[j];
      cache?.scores.set(keys[docIndex], fresh[j]);
    });
    if (cache?.file) {
      fs.mkdirSync(path.dirname(cache.file), { recursive: true });
      fs.writeFileSync(cache.file, JSON.stringify(Object.fromEntries(cache.scores)));
    }
  }
  return docs
    .map((doc, i) => ({ doc, score: scores[i]!, i }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(({ doc, score }) => ({ doc, score }));
}

export async function rerankDocuments(docs: Document[], query: string, topN: number): Promise<Document[]> {
  return (await rankDocuments(docs, query)).slice(0, topN).map((r) => r.doc);
}
