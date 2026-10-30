# Answer-prompt ablation on agentic-v1

- Run: `2026-09-30T15-19-29-721Z`, rows: 150 (errors excluded), judge: gpt-4o
- Evidence held constant: each row's saved evidence rebuilt from the snapshot; the answer model saw the same evidence items (the agent's answer evidence) in both arms.
- Reconstruction check: 0 of the baseline's citations did not match the rebuilt evidence text.
- "Original" is the baseline's own answer and judge verdict (same agent prompt, earlier sample): the gap between it and the agent-prompt arm is sampling noise.

| Slice | N | Original: correctness / correct % / completeness | Agent prompt | RAG v2.1 prompt | Paired (RAG − agent): Δcorrectness, Δcompleteness, RAG better / tie / worse |
|---|---|---|---|---|---|
| overall | 150 | 0.97 / 13.3% / 47.3% | 1.03 / 19.3% / 49.0% | 1.08 / 18.0% / 47.9% | 0.05, -1.1 pts, 19 / 119 / 12 |
| conceptual | 24 | 0.75 / 0.0% / 37.6% | 0.83 / 4.2% / 37.8% | 0.88 / 4.2% / 38.4% | 0.04, 0.6 pts, 2 / 21 / 1 |
| configuration | 24 | 1.04 / 20.8% / 54.2% | 1.00 / 16.7% / 56.0% | 1.04 / 12.5% / 55.0% | 0.04, -1.0 pts, 3 / 19 / 2 |
| cross_file | 27 | 0.81 / 3.7% / 39.3% | 0.96 / 14.8% / 40.0% | 1.11 / 22.2% / 40.1% | 0.15, 0.1 pts, 5 / 21 / 1 |
| dependency_tracing | 24 | 0.92 / 4.2% / 42.5% | 0.88 / 12.5% / 44.4% | 1.00 / 12.5% / 45.6% | 0.13, 1.3 pts, 5 / 17 / 2 |
| exact_lookup | 30 | 1.43 / 43.3% / 67.8% | 1.53 / 53.3% / 69.5% | 1.43 / 43.3% / 62.8% | -0.10, -6.7 pts, 1 / 25 / 4 |
| multi_part | 21 | 0.71 / 0.0% / 36.8% | 0.86 / 4.8% / 41.1% | 0.90 / 4.8% / 42.1% | 0.05, 1.0 pts, 3 / 16 / 2 |

Citations: agent prompt 3.07/answer, valid 100.0%, evidence utilization 41.1%; RAG prompt 3.19/answer, valid 100.0%, utilization 43.2%.

Cost (answers + judge): $1.468. Errors: 0.
