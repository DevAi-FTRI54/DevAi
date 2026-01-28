// Full pipeline test for GitHub API approach
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load environment variables
dotenv.config({
    path: path.resolve(__dirname, '../../config/.env'),
});
async function testFullPipeline() {
    console.log('🧪 Testing Full GitHub API Pipeline');
    try {
        const { GitHubApiService } = await import('./github-api.service.js');
        const { InMemoryCodeLoader } = await import('./memory-loader.service.js');
        const { chunkDocuments } = await import('./chunk.service.js');
        console.log('✅ All modules imported successfully');
        if (!process.env.GITHUB_PAT) {
            throw new Error('GITHUB_PAT not found in environment');
        }
        // Step 1: Fetch repository content
        console.log('\n📡 Step 1: Fetching repository content...');
        const service = new GitHubApiService(process.env.GITHUB_PAT);
        const { files, repoId } = await service.fetchRepositoryContent('https://github.com/microsoft/TypeScript-Node-Starter');
        console.log(`✅ Fetched ${files.length} files`);
        console.log(`📋 Repo ID: ${repoId}`);
        // Step 2: Load into documents
        console.log('\n📚 Step 2: Loading into documents...');
        const repoName = 'TypeScript-Node-Starter';
        const loader = new InMemoryCodeLoader(files, repoId, repoName);
        const docs = await loader.load();
        console.log(`✅ Generated ${docs.length} documents`);
        // Show sample document metadata
        if (docs.length > 0) {
            console.log('\n📋 Sample document metadata:');
            const sampleDoc = docs[0];
            console.log('  File:', sampleDoc.metadata.filePath);
            console.log('  Declaration:', sampleDoc.metadata.declarationName);
            console.log('  Lines:', `${sampleDoc.metadata.startLine}-${sampleDoc.metadata.endLine}`);
            console.log('  Content length:', sampleDoc.pageContent.length);
        }
        // Step 3: Test chunking
        console.log('\n🔪 Step 3: Chunking documents...');
        const chunkedDocs = await chunkDocuments(docs);
        console.log(`✅ Chunked into ${chunkedDocs.length} documents`);
        console.log(`📊 Original: ${docs.length} → Chunked: ${chunkedDocs.length}`);
        // Step 4: Show sample chunks
        console.log('\n📄 Sample chunks:');
        chunkedDocs.slice(0, 3).forEach((doc, i) => {
            console.log(`  ${i + 1}. ${doc.metadata.declarationName} (${doc.pageContent.length} chars)`);
        });
        console.log('\n🎉 Full pipeline test completed successfully!');
        return {
            filesCount: files.length,
            docsCount: docs.length,
            chunkedCount: chunkedDocs.length,
            repoId,
        };
    }
    catch (error) {
        console.error('❌ Pipeline test failed:', error);
        throw error;
    }
}
// Run the test
testFullPipeline()
    .then((result) => {
    console.log('\n✅ All tests passed!');
    console.log('📊 Final results:', result);
})
    .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});
