/**
 * indexRepo =>
 * 1/ Clone repo [done]
 * 2/ Load repo (ts-morph) [done]
 * 3/ Chunk it down - RecursiveChunkSplitter [done]
 * 4/ Load the repo
 * 5/ Turn it into vector embeddings (LangChain)
 * 6/ Upsert
 *
 * queue =>
 * 7/ Retrieve & rerank
 * 8/ Run eval scripts (LangSmith)
 * 9/ Log costs/latency
 */
