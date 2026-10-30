# Retrieval pool experiment on RAG v2.1 (no generation, no judge)

Script: `evals/retrieval-pool.ts`, run `2026-10-05T18-49-56-188Z`, 50 questions × 2 repeats (96 runs; 4 failed on transient network errors). One Cohere rerank call per question: rerank-v3.5 scores documents independently, so every variant's order is a filter of a single ranking over the v2.1 pool plus the whole index.

Range recall = share of expected sources whose line range is overlapped by a context chunk (the harness's localization rule). "All-source" includes optional sources; this is the closest retrieval proxy for the 45% of missed facts that were absent from context (see `missing-facts-and-answer-prompt-rag-v2.1-625d687.md`).

| Variant | Top N | Required range recall | All-source range recall | Context chars |
|---|---|---|---|---|
| v2.1 (base pool) | 5 | 69.6% | 59.2% | 8,654 |
| base pool | 8 | 72.9% | 63.7% | 13,582 |
| base pool | 10 | 76.0% | 66.3% | 16,733 |
| + same-file chunks of top-5 files | 8 | 79.0% | 65.8% | 13,802 |
| + one-import-hop chunks of top-5 files | 8 | 74.3% | 65.2% | 14,672 |
| + both expansions | 8 | 78.0% | 67.7% | 14,823 |
| + both expansions | 10 | 81.6% | 70.2% | 18,312 |
| whole index reranked (no vector search) | 8 | 79.2% | 68.1% | 15,375 |
| whole index reranked (no vector search) | 10 | 82.8% | 71.4% | 18,894 |

- **More context is the main lever; expansion adds a little on top.** Going from 5 to 8 chunks adds 4.5 pts of all-source recall; adding both expansions at 8 adds another 4 (67.7%, +8.5 over v2.1) for ~70% more context.
- **Candidate generation is not the bottleneck.** Pool + expansions at 8 nearly matches reranking the entire index at 8 (67.7% vs 68.1%). Even the whole index at top 10 reaches only 71.4%: the remaining expected sources are not ranked highly for the question text by any pool, i.e. they need a different query (decomposition or follow-up), not a bigger pool.
- **Don't filter unreachable files.** 25 of 104 indexed files are unreachable from `server/src/server.ts` / `client/src/main.tsx`, but 6 golden sources live in them. Removing them lowers all-source recall ~2 pts overall and ~10 pts on dependency_tracing (45.2% → 36.5% at 5).
- **By category (all-source, v2.1 → both expansions at 8):** configuration 70.8 → 89.6%, dependency_tracing 45.2 → 66.0%, multi_part 45.0 → 54.6%, conceptual 47.9 → 52.1%, exact_lookup 90.0 → 90.0%, cross_file 44.8 → 44.8% (expansions crowd cross-file results out at 5: 33.4%). Category slices are 13–20 runs.
