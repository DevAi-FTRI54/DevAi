# RAG v2.2 (candidate expansion, top 8) vs RAG v2.1

v2.2 = v2.1 retrieval and rerank, then every indexed chunk of the top-5 files and of files one relative-import hop away is added and the union reranked; the top 8 go to the unchanged v2.1 answer prompt. Design from `retrieval-pool-rag-v2.1-625d687.md`.

Run `2026-10-05T19-02-05-536Z`, 50 questions × 3 repeats, judge gpt-4o, rerank scores from the eval cache (0 Cohere calls). v2.1 numbers are the saved baseline `rag-v2.1-625d687.json`. Not saved as a baseline.

| Slice | Completeness | Correctness (0–2) | Fully correct | Wrong | Required file recall | Required range recall |
|---|---|---|---|---|---|---|
| overall | 47.1% → **51.3%** | 1.01 → 1.06 | 20.0% → 19.3% | 18.7% → **13.3%** | 85.6% → 90.3% | 67.4% → 75.7% |
| conceptual | 35.0% → 32.6% | 0.88 → 0.63 | 20.8% → 12.5% | 33.3% → 50.0% | 93.8% → 93.8% | 68.8% → 75.0% |
| configuration | 56.3% → 60.4% | 1.21 → 1.13 | 25.0% → 12.5% | 4.2% → 0.0% | 93.8% → 100% | 81.3% → 100% |
| cross_file | 32.9% → **46.1%** | 0.89 → 1.26 | 14.8% → 33.3% | 25.9% → 7.4% | 64.2% → 74.1% | 48.8% → 46.3% |
| dependency_tracing | 49.8% → 53.3% | 0.88 → 0.92 | 4.2% → 0.0% | 16.7% → 8.3% | 81.3% → 89.6% | 50.0% → 64.6% |
| exact_lookup | 67.3% → 73.0% | 1.47 → 1.47 | 46.7% → 46.7% | 0.0% → 0.0% | 100% → 100% | 100% → 100% |
| multi_part | 37.1% → 35.6% | 0.62 → 0.81 | 0.0% → 0.0% | 38.1% → 19.0% | 78.6% → 83.3% | 47.6% → 64.3% |

- **Paired by question** (mean of 3 repeats each, n = 50): completeness +4.2 pts, 95% CI ±3.7; 21 questions better, 19 within 5 pts, 10 worse. Above the ~5-pt single-run noise floor only in aggregate; the per-category moves rest on 7–10 questions each.
- **Wrong answers drop** from 18.7% to 13.3%, the clearest correctness signal (the 0–2 grade itself is noisy; see `missing-facts-and-answer-prompt-rag-v2.1-625d687.md`).
- **Conceptual regresses** (wrong 33% → 50%, 8 questions): more, broader context invites the model to describe the wrong mechanism. Worth watching; not enough data to act on.
- **Cost:** +2,000 prompt tokens per question (3,545 → 5,559), about +$0.0003 per question on gpt-4o-mini; p50 latency 4.3 s → 4.7 s. The harness's cost/q (0.0027 → 0.0050) also prices a second Cohere rerank at the paid rate; on the trial key that is $0 but counts against the call quota (2 calls per question instead of 1).
