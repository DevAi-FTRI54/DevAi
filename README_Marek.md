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

1. Test the entire flow
2. Improve system prompt and user prompt
3. Implement reranking
4. Run eval scripts (LangSmith)
5. Log costs/latency

# FRI

8. Perfect the entire workflow
9. Make the entire workflow work

# SAT/SUN

10. Figure out how to print out on the frontend the progress bar (/jobs/id/:progress)
11. Start learning Python and start learning about LLMs and fine-tuning
12. Implement sending cost tokens etc. to the fron-tend

# ERIC & KYLE

13. Consider implementing sessions so that we don't have to pass repoUrl each time
14. Adjust MongoDB schema (reflecting our z.object)
15. Store the response/answer in our MongoDB
