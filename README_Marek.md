### RAG implementation

0. Clone the repo (dev mode approach - using npm i simple-git)
1. Chunking (ts-morph) - function/class level
   \_ read documentation on ts-morph
2. Call OpenAI embedding-3-large
   \_ system prompt
3. Qdrant vector DB
4. Retrieval + rerank (LangChain.js retriever -> ChatOpenAI)
5. Quality eval scripts
6. Cost/latency dashboard

LangChain

1. LangGraph (Ties together the retrieval and generation steps into a single application)
   \_ https://langchain-ai.github.io/langgraphjs/concepts/langgraph_platform
   \_https://langchain-ai.github.io/langgraphjs/
2. LangSmith
   \_ https://smith.langchain.com/onboarding?organizationId=d8944e14-4793-4347-850d-c2f3d8dc5435&step=3

## Features:

1. Give people option to select any LLM (OpenAI / Anthropic,...)
2. Ask user for the API key
3. Streaming output
4. Chat history

## Kyle

1. GitHub app implementation
   \_ GitHub documentation -> cloning
2. JWT implementation
3.
