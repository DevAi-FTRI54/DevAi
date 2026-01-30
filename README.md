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
- **📍 Citations**: returns file paths, line ranges, and snippets so answers are verifiable.
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

## 📁 Project Structure

```
DevAi/
├── client/                          # React frontend
│   ├── src/
│   └── package.json
├── server/                          # Express + TypeScript backend
│   ├── src/
│   │   ├── features/                # auth, indexing, queries, chatHistory, training
│   │   ├── middleware/
│   │   ├── models/
│   │   └── app.ts
│   ├── .env.example
│   └── package.json
└── package.json                     # root scripts (runs client + server)
```

---

## 🧪 Testing

This `main` branch does not include a dedicated automated test suite yet. A practical smoke test is:

1. Start services and the app (`npm run dev`).
2. Confirm `GET /api/health` returns 200.
3. Complete GitHub OAuth, select a repo, and trigger ingestion.
4. Ask a question and verify that citations reference real files/lines from the repo.

---


