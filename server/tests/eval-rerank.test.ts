import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ragRerankFellBack, agentRerankFallbacks, preflightRerank, RERANK_TOP_N } from '../evals/lib/rerank.js';
import type { ToolStepTrace } from '../src/features/agent/types.js';

const step = (over: Partial<ToolStepTrace>): ToolStepTrace =>
  ({ index: 1, tool: 'semanticSearch', args: { query: 'q' }, status: 'ok', attempts: 1, errors: [], ...over }) as ToolStepTrace;

test('RAG context larger than the rerank topN means the unranked pool was used', () => {
  assert.equal(ragRerankFellBack(RERANK_TOP_N), false);
  assert.equal(ragRerankFellBack(3), false);
  assert.equal(ragRerankFellBack(RERANK_TOP_N + 1), true);
  assert.equal(ragRerankFellBack(15), true);
});

test('agent fallbacks are read from semanticSearch notes; other tools and failed calls are ignored', () => {
  const trace = {
    steps: [
      step({ note: '5 of 5 retrieved chunks.' }),
      step({ note: '5 of 11 retrieved chunks; 1 not in snapshot dropped.' }),
      step({ note: '3 of 3 retrieved chunks.' }),
      step({ status: 'error', note: '5 of 20 retrieved chunks.' }),
      step({ tool: 'readFile', note: '120 of 400 lines' }),
    ],
  };
  assert.deepEqual(agentRerankFallbacks(trace), { searches: 3, fallbacks: 1 });
  assert.deepEqual(agentRerankFallbacks(null), { searches: 0, fallbacks: 0 });
});

test('preflight reports a missing key without calling the network', async () => {
  assert.equal(await preflightRerank(undefined), 'COHERE_API_KEY is not set');
  assert.equal(await preflightRerank(''), 'COHERE_API_KEY is not set');
});
