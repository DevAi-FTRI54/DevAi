// Test script for GitHub API approach
import { GitHubApiService } from './github-api.service.js';
import { InMemoryCodeLoader } from './memory-loader.service.js';
import { chunkDocuments } from './chunk.service.js';
import 'dotenv/config';
async function testGitHubApiApproach() {
    console.log('🧪 Testing GitHub API approach...');
    // You'll need to set your GitHub token in the environment
    const accessToken = process.env.GITHUB_PAT || process.env.GITHUB_ACCESS_TOKEN;
    if (!accessToken) {
        console.error('❌ No GitHub access token found!');
        console.log('💡 Set GITHUB_PAT or GITHUB_ACCESS_TOKEN in your .env file');
        process.exit(1);
    }
    try {
        // Test with a public repository (you can change this)
        const repoUrl = 'https://github.com/octocat/Hello-World';
        console.log(`📡 Testing with repository: ${repoUrl}`);
        // Step 1: Fetch repository content via GitHub API
        const githubService = new GitHubApiService(accessToken);
        const { files, repoId } = await githubService.fetchRepositoryContent(repoUrl);
        console.log(`✅ Fetched ${files.length} files`);
        console.log(`📋 Repo ID: ${repoId}`);
        // Display some file info
        console.log('\n📄 Sample files:');
        files.slice(0, 3).forEach((file) => {
            console.log(`  - ${file.path} (${file.size} bytes)`);
        });
        // Step 2: Load content into documents using in-memory loader
        const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'test-repo';
        const loader = new InMemoryCodeLoader(files, repoId, repoName);
        const docs = await loader.load();
        console.log(`\n📚 Generated ${docs.length} documents`);
        // Display some document info
        console.log('\n📋 Sample documents:');
        docs.slice(0, 3).forEach((doc) => {
            console.log(`  - ${doc.metadata.declarationName} (${doc.pageContent.length} chars)`);
        });
        // Step 3: Test chunking
        const chunkedDocs = await chunkDocuments(docs);
        console.log(`\n🔪 Chunked into ${chunkedDocs.length} documents`);
        console.log('\n🎉 GitHub API approach test completed successfully!');
        return { files, docs, chunkedDocs, repoId };
    }
    catch (error) {
        console.error('❌ GitHub API test failed:', error);
        throw error;
    }
}
// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testGitHubApiApproach()
        .then(() => {
        console.log('✅ All tests passed!');
        process.exit(0);
    })
        .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
}
