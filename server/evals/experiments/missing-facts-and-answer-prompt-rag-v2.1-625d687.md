# Where RAG v2.1 loses key facts, and whether the answer prompt is the cause

Baseline: `evals/baselines/rag-v2.1-625d687.json` (50 questions × 3 repeats). RAG v2.1 covers 47.1% of reference key facts; 389 of 720 judged facts are missed.

## 1. Missing-facts diagnosis (`evals/diagnose-missing-facts.ts`)

For every key fact, gpt-4o was shown the question, the facts, and the exact retrieved chunks (rebuilt from the pinned snapshot), without being told whether the answer covered the fact, and asked whether the chunks contain the code needed to state it.

| Facts | N | Present in context | Partial | Absent |
|---|---|---|---|---|
| Missed by the answer | 389 | 137 (35%) | 78 (20%) | 174 (45%) |
| Covered by the answer (sanity check) | 331 | 289 (87%) | 36 (11%) | 6 (2%) |

Missed facts by category:

| Category | N | Present | Partial | Absent |
|---|---|---|---|---|
| conceptual | 75 | 31% | 27% | 43% |
| configuration | 47 | 19% | 26% | 55% |
| cross_file | 100 | 25% | 17% | 58% |
| dependency_tracing | 54 | 48% | 24% | 28% |
| exact_lookup | 44 | 86% | 0% | 14% |
| multi_part | 69 | 23% | 23% | 54% |

- The covered-fact check (2% absent) says the classifier is reliable.
- Absent facts are mostly a chunk-selection problem, not a file-recall problem: of 96 answers with an absent missed fact, only 32 also missed a required file. Retrieval keeps 5 chunks from ~3.7 distinct files; in those answers the chunks overlapped the expected range for 59% of required sources and 42% of optional ones.
- Of 47 required files retrieval missed, 33 (70%) are one relative-import hop from a retrieved file.
- The unreachable `index-production.*` files are retrieved and cited as if live (e.g. D02, X05).
- Cost: ~$0.60 (gpt-4o), 71 unique contexts.

## 2. Answer-prompt ablation (`evals/ablate-rag-answer-prompt.ts`)

All 50 golden questions use the Find prompt, whose step 3 caps answers at "≤ 3 short paragraphs (≈ 60-120 words total)". Each baseline row's exact context (indexed chunks fetched from the eval collection; 0 fallbacks) was held constant and answered twice with gpt-4o-mini: **control** = verbatim v2.1 prompts, **complete** = step 3 replaced with "Explain the behaviour completely: name every file, function, call, condition, return value and configuration value in the evidence that bears on the question, and for flows give every step in order. Be economical with words, not with facts." Both judged by gpt-4o.

Run `2026-10-05T18-07-11-651Z`; cells are correctness (0–2) / fully correct / completeness.

| Slice | N | Original | Control | Complete | Paired complete − control: Δcorrectness, Δcompleteness, better / tie / worse |
|---|---|---|---|---|---|
| overall | 149 | 1.01 / 20.0% / 47.1% | 0.96 / 15.3% / 47.5% | 1.02 / 19.5% / 48.8% | 0.06, 1.2 pts, 20 / 119 / 10 |
| conceptual | 24 | 0.88 / 20.8% / 35.0% | 0.75 / 8.3% / 35.0% | 0.88 / 20.8% / 36.9% | 0.13, 1.9 pts, 5 / 17 / 2 |
| configuration | 23 | 1.21 / 25.0% / 56.3% | 1.08 / 20.8% / 52.5% | 1.13 / 17.4% / 51.7% | 0.04, -1.3 pts, 2 / 20 / 1 |
| cross_file | 27 | 0.89 / 14.8% / 32.9% | 0.93 / 14.8% / 35.8% | 1.00 / 18.5% / 41.9% | 0.07, 6.1 pts, 5 / 20 / 2 |
| dependency_tracing | 24 | 0.88 / 4.2% / 49.8% | 0.79 / 4.2% / 49.6% | 0.79 / 4.2% / 45.2% | 0.00, -4.4 pts, 2 / 20 / 2 |
| exact_lookup | 30 | 1.47 / 46.7% / 67.3% | 1.37 / 36.7% / 67.2% | 1.47 / 46.7% / 70.8% | 0.10, 3.7 pts, 6 / 21 / 3 |
| multi_part | 21 | 0.62 / 0.0% / 37.1% | 0.71 / 0.0% / 41.0% | 0.71 / 0.0% / 40.9% | 0.00, -0.1 pts, 0 / 21 / 0 |

- Answers grew from 691 to 1,123 characters on average; completeness moved +1.2 pts, within noise. One row (G07#1, complete) failed structured-output parsing and is excluded.
- Against the diagnosis: of baseline-missed facts that were present in context, complete recovered 39/136 (29%) versus control 16/137 (12%) from resampling alone; it also lost 36/329 (11%) of baseline-covered facts versus control 24/331 (7%). Net ≈ +11 facts of 720.
- Cost: $1.52.

## Judge noise

At temperature 0, only 13 of 150 control answers were byte-identical to the baseline answer. On those 13 identical answers the judge changed the correctness grade 5 times but flipped 0 of 57 fact verdicts. Fact-level completeness is stable for a given answer; the 0–2 correctness grade is not. Compare systems primarily on completeness, and only trust correctness differences averaged over repeats.

## Conclusion

Answer generation is not the bottleneck: removing the length cap adds words, not reference facts, consistent with the earlier agentic-v1 answer-prompt ablation. The lever is retrieval, the 45% of missed facts whose code never reached the context: more chunks for cross-file / multi-part / configuration questions, expanding chunks to their enclosing declaration or neighbors, one-hop import expansion, and down-ranking unreachable files.
