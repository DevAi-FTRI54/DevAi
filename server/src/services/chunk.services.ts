import express from 'express';

/**
 * - Read LangChain article on LangChain
 * ---> https://js.langchain.com/docs/tutorials/rag/
 * ---> https://js.langchain.com/docs/tutorials/qa_chat_history/
 * - Read ts-morph
 * ---> https://www.npmjs.com/package/ts-morph
 * - Create one Project instance and reuse it
 * - Pass skipFileDependencyResolution: true (skip node modules)
 * - Chunk at function / class granularity
 * - Grab the text via getFullText() and store {startLine, endLine}
 * - Strip imports / exports (optional)
 * - No type-checking on MVP (Calling project.getTypeChecker() is cool—but 10-20× slower; skip until v2.)
 */
