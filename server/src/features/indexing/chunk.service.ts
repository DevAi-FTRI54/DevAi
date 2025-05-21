import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 2000,
  chunkOverlap: 400,
});

export async function chunkDocuments(docs: Document[]): Promise<Document[]> {
  const bigDocs: Document[] = [];
  const smallDocs: Document[] = [];

  for (const doc of docs) {
    // 6000 tokens ~200 lines of code
    if (doc.pageContent.length > 6000) {
      const subDocs = await splitter.splitDocuments([doc]); // <- How is it going to be split?
      bigDocs.push(...subDocs);
    } else smallDocs.push(doc);
  }

  return [...smallDocs, ...bigDocs];
}
