import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 2000,
    chunkOverlap: 400,
});
export async function chunkDocuments(docs) {
    const bigDocs = [];
    const smallDocs = [];
    for (const doc of docs) {
        // 6000 tokens ~200 lines of code
        if (doc.pageContent.length > 6000) {
            const subDocs = await splitter.splitDocuments([doc]); // <- How is it going to be split?
            bigDocs.push(...subDocs);
        }
        else
            smallDocs.push(doc);
    }
    return [...smallDocs, ...bigDocs];
}
