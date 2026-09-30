# DevAI 🚀

> **DevAI is a full-stack project that indexes a GitHub repository and provides a chat UI for asking questions about the codebase with file-based citations.**

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue)](https://github.com/DevAi-FTRI54/DevAi)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)

---

## 🚀 What is DevAI?

DevAI is an AI-assisted codebase exploration tool. After you connect a GitHub repository, the backend ingests source files, stores embeddings in a vector database, and supports natural-language questions with answers grounded in retrieved code context (including citations).

## 📈 Measured, not assumed

DevAI demoed well. Answers read confidently and every one came with citations. So before changing anything, I built an evaluation harness: 50 questions about DevAI's own code, each with labeled source lines and required facts, scored by deterministic checks and an LLM judge.

The first run was humbling. Only **14% of answers were fully correct**, and **fewer than half of the citations pointed at code that actually exists at the cited lines**. Retrieval turned out not to be the problem: the right files came back for 85% of required sources. The failures were in grounding. Chunks carried the wrong line numbers, and the model retyped code from memory instead of quoting it.

Each fix was benchmarked against the one before it, and every milestone is kept as a write-once baseline:

| Milestone | What changed | Citation validity | Fully correct |
|---|---|---|---|
| RAG v0 | Original implementation, first measured | 46% | 14% |
| RAG v1 | Deterministic bug fixes: chunk line ranges, prompt routing, error taxonomy | 51% | 15% |
| RAG v2 | Server-assembled citations from verified evidence; the model cites IDs, never code | 94% ¹ | 15% |
| RAG v2.1 | Stabilization: no whitespace-only citations, a checker that accepts verbatim comments, and a one-line prompt fix for a completeness regression | **100%** | 20% |
| Agentic v1 | Next: planning and multi-step retrieval for multi-part and cross-file questions | — | — |

¹ 93.9% passed the checker, and 100% of returned snippets were sourced from retrieved code. The checker at the time rejected verbatim comment-only snippets; see [RAG v2.1](#rag-v21-stabilization-rag-v21-625d687json).

Citations are now solved. Answer quality is not: multi-part questions still score 0.62 out of 2, and completeness is stuck below 50%. That is the problem the agentic architecture has to beat, measured on the same benchmark against the same baselines. Details are in [Evaluation](#-evaluation).

## Proof

Live demo: https://www.dev-ai.app/

### Screenshots:

Select a Repo:
<img width="2996" height="1482" alt="image" src="https://github.com/user-attachments/assets/de2675b6-f6de-4be9-9d38-83c58c3d7c59" />

Repo Ingestion:
<img width="2970" height="1468" alt="image" src="https://github.com/user-attachments/assets/4dbcc04f-71ee-4d63-93ad-b9b53e2f1dae" />

Question and Response:
<img width="2976" height="1484" alt="image" src="https://github.com/user-attachments/assets/7d71990f-ddb8-4346-a10e-a6e52e7e121b" />

### 🎯 Core Features

- **🤖 Retrieval-augmented Q&A (RAG)**: retrieves relevant code chunks from Qdrant before generating an answer.
- **📍 Verified citations**: the model cites evidence IDs and line ranges; the server builds each citation (file, lines, exact source snippet) from the retrieved evidence, so every snippet shown is real code.
- **🔐 GitHub OAuth + GitHub App**: authenticates users and lists repositories accessible via app installation.
- **⚙️ Background ingestion**: indexing runs asynchronously using BullMQ + Redis.
- **⚡ Streaming responses**: query responses are streamed to the client (SSE) for incremental rendering.
- **🗂️ Conversation history**: chat sessions are stored in MongoDB.

---

## 🌐 Getting Started

### Option 1: Hosted demo

If available, the app has been deployed at `https://www.dev-ai.app/`.

> Note: the demo may take a few seconds to "wake up" on first load if the backend has been idle.

---

### Option 2: Run DevAI Locally (Development)

#### Prerequisites

- Node.js 18+
- MongoDB
- Redis (BullMQ queue)
- Qdrant (vector database)
- A GitHub App (OAuth + installation) with access to at least one repo
- OpenAI API key (this `main` branch uses OpenAI via LangChain)

#### 1) Clone the repository

```bash
git clone https://github.com/DevAi-FTRI54/DevAi.git
cd DevAi
```

#### 2) Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

#### 3) Start external services (MongoDB, Redis, Qdrant)

If you use Docker:

```bash
docker run -d -p 27017:27017 --name devai-mongo mongo:latest
docker run -d -p 6379:6379 --name devai-redis redis:latest
docker run -d -p 6333:6333 --name devai-qdrant qdrant/qdrant:latest
```

#### 4) Environment setup

Create `server/.env`. This repo includes `server/.env.example`—you can start from it and add the missing keys below.

**Server Environment (`server/.env`)**

```env
# Where the frontend is running (used for redirects)
FRONTEND_BASE_URL=http://localhost:5173

# GitHub App credentials
GITHUB_APP_CLIENT_ID=...
GITHUB_APP_CLIENT_SECRET=...
GITHUB_APP_ID=...

# GitHub App private key contents (PEM)
# Many hosting platforms store this with literal "\n" sequences.
GITHUB_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Auth
JWT_SECRET=... # use a long random string

# Datastores
MONGO_URI=mongodb://localhost:27017/devai
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY= # optional

# LLM + reranking (Cohere is optional)
OPENAI_API_KEY=...
COHERE_API_KEY=

# Server
PORT=4000
NODE_ENV=development
```

Create `client/.env`:

**Client Environment (`client/.env`)**

```env
VITE_API_BASE_URL=http://localhost:4000/api
# Optional: where the UI redirects after GitHub App installation
VITE_POST_INSTALL_REDIRECT=http://localhost:5173/select-repo
```

#### 5) GitHub App configuration (high level)

1. GitHub → Settings → Developer settings → GitHub Apps
2. Create a GitHub App and generate a client ID/secret + a private key.
3. Set the OAuth callback URL to: `http://localhost:4000/api/auth/callback`
4. Install the app into your account/org and grant it access to at least one repository.

#### 6) Start the application

From the repo root:

```bash
npm run dev
```

#### 7) Access the app

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:4000/api

Useful endpoints:

- `GET /api/health` (returns 200; includes Mongo connection state)
- `GET /api/keep-alive`
- `POST /api/index/ingest` and `GET /api/index/status/:id`
- `POST /api/query/question` (streams response)

---

## 🏗️ Architecture & Data Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │────│  Express API    │────│   GitHub API    │
│   (Frontend)    │    │   (Backend)     │    │   (Data Source) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Qdrant + OpenAI  │
                    │   (RAG pipeline)  │
                    └───────────────────┘
```

1. **Auth**: user authenticates via GitHub OAuth.
2. **Ingest**: backend queues an indexing job; the worker clones/loads files, chunks them, and upserts embeddings to Qdrant.
3. **Ask**: query endpoint retrieves relevant chunks and generates a response with citations.

---

## 📊 Evaluation

DevAI is measured against a fixed golden set rather than spot-checked by hand. The harness lives in `server/evals/`.

- **Golden set**: 50 questions about DevAI's own code, pinned to commit `625d687` (`server/evals/golden/devai-625d687.json`). Categories: exact lookup (10), conceptual (8), cross-file (9), dependency tracing (8), configuration (8), multi-part (7). Each question lists expected source files/line ranges and the key facts a complete answer must contain.
- **Isolation**: the pinned repo is ingested into its own Qdrant collection (`devai_eval_01`), through the same loader, chunker, and embedding code as production. Each question runs through the real `answerQuestion` pipeline.
- **Can't hit production by accident**: eval scripts take their Qdrant and MongoDB connections only from `server/.env.eval` (local by default, committed, no secrets). API keys still come from `server/.env`. A run refuses to start if an eval target is missing, matches the app's production host or collection, or is remote without an explicit opt-in. Every run prints and records the targets it used.
- **Deterministic metrics**: retrieval file recall and line-range recall, and citation validity (the cited file exists, the lines are in range, and the snippet actually appears at those lines).
- **LLM judge** (`gpt-4o`): correctness (0 wrong / 1 partial / 2 correct) and completeness (share of key facts covered), scored separately.
- **Cost and latency**: tokens, dollars, p50/p95 latency per question.

Prerequisites: local Qdrant on `:6333` and MongoDB on `:27017` (see `server/.env.eval`), plus `OPENAI_API_KEY` and `COHERE_API_KEY` in `server/.env`.

```bash
cd server
npm run eval:ingest                    # clone the pinned repo and index it (use -- --reset to rebuild)
npm run eval:validate                  # check every golden label against the pinned source
npm run eval:run -- --system rag-v2.1 --repeats 3     # full run; results land in server/evals/results/
npm run eval:run -- --system agentic-v1 --repeats 3   # same golden set through the agent
npm run eval:run -- --system rag-v2.1 --repeats 3 --save-baseline rag-v3   # record a milestone (never overwrites)
```

`--system` is required, so a run always says which pipeline it measured. A baseline label must match the system (`rag-*` or `agentic-*`). Agent runs also record each question's full trace (tool calls, arguments, evidence IDs, tokens, latency, retries, stop reason) in `results.jsonl`, and add an Agent section to the summary.

Milestone baselines are committed in `server/evals/baselines/` and are write-once, so the history stays honest.

### Milestones

#### RAG v0: original implementation (`baseline-625d687.json`)

Where DevAI stood before systematic evaluation: LangGraph retrieve → rerank → generate; multi-query retrieval over Qdrant MMR (k=8), Cohere `rerank-v3.5` top 5, `gpt-4o-mini` with structured citations. Single run, 50 questions.

| Metric | RAG v0 |
|---|---|
| File recall (required files retrieved) | 84.3% |
| Required line-range recall | 69.3% |
| Citation validity | 47.6% |
| Citations grounded in retrieved context | 91.5% |
| Correctness (0–2) / fully correct | 1.00 / 14% |
| Completeness (key facts covered) | 44.7% |
| Latency p50 / p95 | 4.4 s / 7.4 s |
| Cost per question | $0.0026 |

By category, multi-part questions were weakest (correctness 0.57, completeness 25%) and cross-file retrieval had the lowest file recall (63%).

What the evaluation surfaced:

- **Wrong citation line numbers.** Large files are split into chunks, but each chunk kept its parent file's full line range. 56% of retrieved documents were chunks, so the model was told the wrong lines for most of its context.
- **Misleading errors.** Any retrieval failure, including an OpenAI auth or quota error, was reported as `VECTOR_DB_DOWN`.
- **Walkthrough prompt never used.** The client sent `WalkThrough` but the server key is `Walkthrough`, so walkthrough requests silently used the Find prompt.

#### RAG v1: corrected baseline (`rag-v1-625d687.json`)

Only the three bugs above were fixed, each in its own commit. Chunking, retrieval, reranking, prompts, and the golden set are unchanged.

- **Chunk line ranges** (`fa492da`): split chunks now carry their real source lines. The splitter's chunk-relative line offsets are converted to file lines, based at the line where the parent text actually begins. That is line 1 for whole-file documents, which previously claimed a later start whenever a file opened with comments, and the leading-trivia line for functions and classes. Verified offline: all 174 chunks and 82 whole-file documents now match the source line for line.
- **Walkthrough prompt** (`4918264`): the client sends `Walkthrough`, and the server resolves prompt types case-insensitively.
- **Error taxonomy** (`6056c13`): failures are classified as `MODEL_AUTH`, `MODEL_QUOTA`, `MODEL_RATE_LIMIT`, `MODEL_ERROR`, `VECTOR_DB_DOWN`, or `INTERNAL`, with the pipeline stage and the original cause. The code and stage are sent to the client over SSE. During these runs it correctly reported a real OpenAI credit outage as `MODEL_QUOTA` and a transient Qdrant failure as `VECTOR_DB_DOWN`.

The v0 baseline was a single run, so v0 was re-measured with 3 repeats (without the judge) for a like-for-like comparison. The line-range fix was also measured on its own, as a single run, before the other two fixes landed:

| Metric | RAG v0 (3 repeats) | Line-range fix only (1 run) | RAG v1 (3 repeats) | Δ v0 → v1 |
|---|---|---|---|---|
| File recall | 84.9% | 84.0% | 84.4% | −0.5 pts |
| Range hit | 94.7% | 92.0% | 92.0% | −2.7 pts |
| Required line-range recall | 67.6% | 66.0% | 66.0% | −1.6 pts |
| **Citation validity** | **45.6%** | **65.4%** | **50.8%** | **+5.2 pts** |
| Citations grounded in retrieved context | 89.2% | 97.4% | 97.5% | +8.3 pts |
| Citations pointing at an expected file | 88.8% | 88.5% | 89.8% | +1.0 pts |
| Correctness (0–2) / fully correct | 1.00 / 14% ¹ | 0.96 / 10% | 1.01 / 15% | ≈ 0 |
| Completeness | 44.7% ¹ | 47.5% | 47.9% | +3.2 pts |
| Latency p50 / p95 | 4.7 s / 7.7 s | 5.6 s / 11.4 s | 5.3 s / 9.9 s | provider variance |
| Cost per question | $0.0026 | $0.0026 | $0.0026 | 0 |

¹ From the original single v0 run; the 3-repeat re-measurement skipped the judge.

Per-repeat citation validity ranged 44–48% for v0 and 45–55% across six v1 repeats. The 65.4% line-fix-only run was a lucky draw outside that range. The line fix is a real but modest gain, not a jump. Retrieval metrics moved by amounts within run-to-run noise; embedded text is identical, only line metadata changed. What changed is *why* citations fail:

| Why a citation fails (share of all citations) | v0 | v1 |
|---|---|---|
| Real code, wrong line numbers | 21% | 13% |
| Snippet edited or abbreviated by the model (`...`, rewritten lines) | 25% | 30% |
| Snippet not verbatim at all | 4% | 5% |

**Takeaway:** retrieval was never the main problem. The right file is retrieved for 85% of required sources, and some relevant file for every question. Fixing the line metadata halved the wrong-line citations and made cited ranges line up with retrieved context (grounded 89% → 98%). But the dominant weakness is generation fidelity: `gpt-4o-mini` paraphrases or elides the code it quotes, and multi-part questions stay weakest (correctness 0.62, completeness 36%). That points the next milestone at citation construction and answer planning (Agentic v1), not at chunking or retrieval tuning.

Latency was 4.7 s p50 for v0 versus 5.3 s for v1, with no pipeline change on the request path. Treat it as provider variance between runs.

#### RAG v2: deterministic evidence layer (`rag-v2-625d687.json`)

v1 showed that citations failed mainly because the model retyped code and line numbers. v2 takes that job away from the model (`344b03e`):

- Every reranked chunk that fits the prompt budget becomes an **evidence item** `{id, repoId, filePath, startLine, endLine, content}` and is shown to the model with an ID (`[E1]`) and numbered source lines.
- The model returns citations as `{evidenceId, startLine, endLine}` only. It can no longer write a file path or a snippet.
- At response time the server verifies the evidence ID and checks the file against a local clone when one unambiguously exists. It clamps the line range to the evidence (falling back to the whole evidence item if the range misses it entirely), trims blank edges, removes duplicates, and copies the exact source text into the snippet. No model-written snippet reaches the UI or MongoDB.
- The prompt budget is still measured on the old un-numbered format, so v2 sees exactly the same chunks as v1.

A small fix landed alongside it (`3dd1587`): chunks split from a function or class had inherited the parent's text-start line, which would have misplaced 13 evidence items.

| Metric | RAG v1 (3 repeats) | RAG v2 (3 repeats) | Δ v1 → v2 |
|---|---|---|---|
| File recall | 84.4% | 84.6% | +0.2 pts |
| Range hit | 92.0% | 94.0% | +2.0 pts |
| Required line-range recall | 66.0% | 68.1% | +2.1 pts |
| **Citation validity** | **50.8%** | **93.9%** | **+43.1 pts** |
| Citations grounded in retrieved context | 97.5% | 100.0% | +2.5 pts |
| Citations pointing at an expected file | 89.8% | 90.9% | +1.1 pts |
| Citations per answer / median cited span | 1.6 / 45 lines | 2.2 / 8 lines | tighter |
| Citations dropped by server verification | n/a | 0 of 330 | — |
| Correctness (0–2) / fully correct | 1.01 / 15% | 0.97 / 15% | ≈ 0 |
| Completeness | 47.9% | 42.9% | −5.0 pts |
| Latency p50 / p95 | 5.3 s / 9.9 s | 4.1 s / 6.2 s | −1.2 s / −3.7 s |
| Prompt / completion tokens per question | 2,819 / 343 | 3,538 / 214 | line numbers in, snippets out |
| Cost per question | $0.0026 | $0.0027 | +$0.0001 |

**Result: 93.9% checker-valid citations, with 100% of returned snippets deterministically sourced from retrieved code.** The remaining 6% are not bad citations. Every one of the 330 snippets is the exact source text. 22 differ only by the first line's leading indentation (see below). Of the 20 citations the checker rejected:

- 17 cite comment-only lines. They are verbatim, but the checker strips comments before comparing (a rule designed for model-written snippets), which leaves nothing to match.
- 2 have a `/* ... */` block comment crossing the edge of the cited window.
- 1 cites a single blank line. This is a real small gap: the server should reject whitespace-only ranges.

The server kept all 330 citations the model requested. 5 ranges were clamped, and 5 missed their evidence item entirely and fell back to its full range.

Things to watch:

- **Completeness dipped** (−5 pts, with conceptual questions hardest hit: 34% → 23%). Answers got about 10% shorter now that the model isn't writing snippets. It is not yet clear whether this is noise or the new instructions making answers terser.
- **Indentation without a local clone.** This run had three commit folders cached for the repo, so the server treated the clone as ambiguous and used the indexed text, which is the realistic production path. The splitter trims leading whitespace from chunks, so a citation that starts on a chunk's first line loses that line's indentation. With exactly one clone present, snippets are byte-exact.
- Latency improved because the model writes far fewer output tokens.

With citations now deterministic, the remaining weaknesses are answer quality: multi-part correctness is 0.57 and overall completeness is 43%. Those point at retrieval coverage for multi-file questions and at answer planning, which is the natural scope for Agentic v1.

#### RAG v2.1: stabilization (`rag-v2.1-625d687.json`)

A small correctness pass before Agentic v1. It is not an optimization phase: chunking, retrieval, MultiQuery, MMR, and reranking are unchanged.

- **No whitespace-only citations** (`fc510bd`). If the model's range selects only blank lines, the server falls back to the whole evidence item, or drops the citation if the evidence itself is blank. This fired once in the targeted rerun below.
- **Checker accepts verbatim snippets** (`79179f4`). The eval now checks for a whitespace-insensitive verbatim match before applying the comment-stripping comparison built for model-written snippets. The existing baselines are left untouched. Re-scoring their saved answers with the new checker shows the change is symmetric and does not flatter v2 alone:

  | Saved run | Old checker | New checker |
  |---|---|---|
  | RAG v0 (original run) | 47.6% | 48.8% |
  | RAG v1 | 50.8% | 53.3% |
  | RAG v2 | 93.9% | 99.7% (the one miss was the blank-line citation) |

- **Completeness regression, investigated then fixed** (`58d4d34`). In v2, completeness fell 5 points, concentrated in conceptual questions (35.6% → 23.3% against six v1 repeats). Inspecting C01–C08 ruled out the obvious explanations. Retrieval was identical (same files for every question), answers were only 4% shorter, and the judge sees citation paths and line ranges, never snippets, so every credited fact came from the answer text. The real change was **narrower** answers: the model described only the one or two tight ranges it cited and dropped facts from other retrieved evidence. For example, C06 lost "tokens are estimated by `roughTokens`" (6/6 v1 repeats → 0/3), and C04 lost "the retrieve node invokes the retriever" (6/6 → 0/3). One added instruction, to answer completely from all the evidence and not narrow the explanation because snippets are attached separately, recovered it. A targeted rerun of the three regressed categories came first (conceptual 23.3% → 33.1%, dependency tracing 43.5% → 48.1%), then the full run below.

| Metric | RAG v1 (3 repeats) | RAG v2 (3 repeats) | RAG v2.1 (3 repeats) | Δ v2 → v2.1 |
|---|---|---|---|---|
| File recall | 84.4% | 84.6% | 85.6% | +1.0 pts |
| Required line-range recall | 66.0% | 68.1% | 67.4% | −0.7 pts |
| **Citation validity** (checker of the time) | 50.8% | 93.9% | **100.0%** | +6.1 pts |
| Citations grounded in retrieved context | 97.5% | 100.0% | 100.0% | 0 |
| Citations pointing at an expected file | 89.8% | 90.9% | 86.6% | −4.3 pts |
| Citations per answer / median cited span | 1.6 / 45 lines | 2.2 / 8 lines | 2.6 / 6 lines | broader, tighter |
| Correctness (0–2) / fully correct | 1.01 / 15% | 0.97 / 15% | 1.01 / **20%** | +5 pts fully correct |
| **Completeness** | 47.9% | 42.9% | **47.1%** | +4.2 pts |
| Latency p50 / p95 | 5.3 s / 9.9 s | 4.1 s / 6.2 s | 4.3 s / 6.3 s | ≈ |
| Cost per question | $0.0026 | $0.0027 | $0.0027 | 0 |

Every citation the server returned passes the checker, and completeness is back to v1's level while keeping v2's citation guarantees. The rise to 20% fully correct is encouraging, but it is within the range of run-to-run noise until another run confirms it. Broader answers now also cite files outside the labeled sources more often (expected-file share 90.9% → 86.6%, mostly in configuration questions). Those citations are real code, but not always the most relevant file.

**Known follow-ups** (deliberately not part of Phase 1):

- **Tie the source of truth to the indexed commit.** The server currently reads snippet text from a local clone only when exactly one cached clone exists for the repo, and otherwise uses the indexed text. The authoritative source should be the exact commit that was indexed: store its SHA in the index payload and name clone folders by the resolved SHA, not `HEAD`. This matters once agent tools such as `readFile` exist, because every tool call and every citation must read the same repo snapshot. *(Done in Phase 2, below.)*
- **Transient local Qdrant failures.** Two of roughly 900 eval questions run so far failed with `fetch failed` against local Qdrant, correctly classified as `VECTOR_DB_DOWN`. This is worth a retry policy on retrieval.

With citations solved and measured cleanly, Phase 1 is complete. The open problems are answer quality on multi-part (0.62) and cross-file (0.89) questions, which is where Agentic v1 starts.

#### Phase 2 groundwork: pinned snapshots and code tools (no agent yet)

An agent that reads files, greps, and searches can only be trusted if every one of those calls sees the same code the index was built from. So before any agent loop, this step makes the commit explicit and builds the tools on top of it. RAG v2.1 retrieval, chunking, reranking, and generation are unchanged.

- **One commit, end to end.** Indexing resolves the repo (`HEAD`, a branch, a tag, or a SHA) to a full commit SHA, caches the checkout at `.cache/repos/<repoId>/<sha>`, and stores `commitSha` on every indexed document and chunk. Citation snippets are read from that commit's snapshot. Older indexes without a SHA keep the previous rule.
- **Tools over the pinned snapshot** (`server/src/features/tools/`): `readFile`, `grepSearch`, `semanticSearch` (the v2.1 retriever and reranker wrapped as a tool, which drops hits from any other commit), `findDefinition`, and `findReferences` (ts-morph, syntax-aware, so comments and strings don't count).
- **One evidence shape for all tools:** repo, commit, file, line range, exact snapshot text, and which tool produced it. An `EvidenceStore` numbers evidence from any mix of tools as `E1…En`, and the same deterministic citation layer from v2 turns the model's evidence references into citations.
- **Deterministic tests** for each tool and for the snapshot and citation plumbing (`npm test` in `server/`, using local git fixtures with no network or API keys).

Check that nothing regressed: after re-ingesting the eval collection with commit SHAs, a no-judge run of all 50 questions matched v2.1 (file recall 86.3% vs 85.6%, range hit 92.0% vs 92.0%, citation validity 100% vs 100%, 0 errors). No new baseline was saved, since behavior did not change. The agent loop and tool routing come next.

---

## 📁 Project Structure

```
DevAi/
├── client/                          # React frontend
│   ├── src/
│   └── package.json
├── server/                          # Express + TypeScript backend
│   ├── src/
│   │   ├── features/                # auth, indexing, queries, tools, chatHistory, training
│   │   ├── middleware/
│   │   ├── models/
│   │   └── app.ts
│   ├── evals/                       # golden set, eval harness, milestone baselines
│   ├── tests/                       # deterministic unit tests (npm test)
│   ├── .env.example
│   └── package.json
└── package.json                     # root scripts (runs client + server)
```

---

## 🧪 Testing

Answer quality is measured by the golden-set evaluation harness (see [Evaluation](#-evaluation)). Deterministic unit tests cover commit snapshots, indexed-commit citations, and the code tools. They run offline against local git fixtures:

```bash
cd server
npm test            # node:test via tsx
npm run test:types  # typecheck src + tests
```

A practical end-to-end smoke test is:

1. Start services and the app (`npm run dev`).
2. Confirm `GET /api/health` returns 200.
3. Complete GitHub OAuth, select a repo, and trigger ingestion.
4. Ask a question and verify that citations reference real files/lines from the repo.
  
   Planned next: integration tests for the ingestion and query endpoints.

---


