import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 2000,
  chunkOverlap: 400,
});

// The splitter's loc.lines is relative to the parent's pageContent; convert it to source-file lines
// so citations point at the chunk, not the whole parent.
function toAbsoluteLines(chunk: Document, parent: Document): Document {
  const { loc, ...rest } = chunk.metadata;
  const from = loc?.lines?.from;
  const to = loc?.lines?.to;
  if (typeof from !== 'number' || typeof to !== 'number') return chunk;
  const base = Number(parent.metadata.textStartLine ?? parent.metadata.startLine ?? 1);
  return new Document({
    pageContent: chunk.pageContent,
    metadata: {
      ...rest,
      startLine: base + from - 1,
      endLine: base + to - 1,
      chunked: true,
    },
  });
}

export async function chunkDocuments(docs: Document[]): Promise<Document[]> {
  const bigDocs: Document[] = [];
  const smallDocs: Document[] = [];

  for (const doc of docs) {
    // 6000 tokens ~200 lines of code
    if (doc.pageContent.length > 6000) {
      const subDocs = await splitter.splitDocuments([doc]); // <- How is it going to be split?
      bigDocs.push(...subDocs.map((d) => toAbsoluteLines(d, doc)));
    } else smallDocs.push(doc);
  }

  return [...smallDocs, ...bigDocs];
}
