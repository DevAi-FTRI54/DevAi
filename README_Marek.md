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

## LangChain

7. LangGraph (Ties together the retrieval and generation steps into a single application)
   \_ https://langchain-ai.github.io/langgraphjs/concepts/langgraph_platform
   \_https://langchain-ai.github.io/langgraphjs/
8. LangSmith
   \_ https://smith.langchain.com/onboarding?organizationId=d8944e14-4793-4347-850d-c2f3d8dc5435&step=3

## Features:

1. Give people option to select any LLM (OpenAI / Anthropic,...)
2. Ask user for the API key
3. Streaming output
4. Chat history

## Questions:

1. Should frontend pass repoUrl with each chat?
   \_ OR should we create a session when user selects a repo:

```
// Create a session when user selects a repo
app.post('/api/session', (req, res) => {
  const { repoId, userId } = req.body;
  const sessionId = createSession(repoId, userId);
  res.json({ sessionId });
});

// Query using session
app.post('/api/query', (req, res) => {
  const { sessionId, question } = req.body;
  const session = getSession(sessionId);
  const result = await answerQuestion(session.repoId, question);
  res.json(result);
});
```

## TODO:

# THUR

1. Implement reranking [done]
2. Log costs/latency [done]
3. Test the entire flow
4. Implement type prompt inside askController
5. Improve system prompt and user prompt
6. Implement MongoDB

## BACKLOG

8. Run eval scripts (LangSmith)
9. Handshake BE/FE
10. Perfect the entire workflow (remove PAT, integrate repoUrl and sha through GitHub app)
11. Make the entire workflow work
12. Implement sending cost tokens etc. to the fron-tend

# macOS with Homebrew

brew install redis
brew services start redis

# SAT/SUN

10. Learn Python
11. Read about LLM fine-tuning (LoRA)

# ERIC & KYLE

1. Figure out how to get sha on the front-end and pass it to the backend
2. Eric + Kyle -> fetch repos from GitHub app - http://localhost:4000/api/github/repos
3. Figure out how to print out on the frontend the progress bar (/jobs/id/:progress)
   \_ Progress bar - Frontend immediately gets { jobId } and polls /jobs/:id/progress
4. Figure out how to make "snippet" optional

## BACKLOG

4. Consider implementing sessions so that we don't have to pass repoUrl each time
5. Adjust MongoDB schema (reflecting our z.object)
6. Store the response/answer in our MongoDB
