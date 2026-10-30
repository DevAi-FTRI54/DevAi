// Simple test for GitHub API service
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load environment variables
dotenv.config({
    path: path.resolve(__dirname, '../../config/.env'),
});
console.log('🧪 Simple GitHub API Test');
console.log('GitHub PAT available:', !!process.env.GITHUB_PAT);
// Test basic imports
try {
    const { GitHubApiService } = await import('./github-api.service.js');
    console.log('✅ GitHubApiService imported successfully');
    if (process.env.GITHUB_PAT) {
        const service = new GitHubApiService(process.env.GITHUB_PAT);
        console.log('✅ GitHubApiService instance created');
        // Test with a repo that has TypeScript files
        const result = await service.fetchRepositoryContent('https://github.com/microsoft/vscode-extension-samples');
        console.log(`✅ Fetched ${result.files.length} files from Hello-World repo`);
        console.log('Sample files:', result.files.slice(0, 2).map((f) => f.path));
    }
}
catch (error) {
    console.error('❌ Test failed:', error);
}
