// GitHub API service for fetching repository content without cloning
import { Octokit } from 'octokit';
import { logger } from '../../utils/logger.js';
export class GitHubApiService {
    octokit;
    constructor(accessToken) {
        this.octokit = new Octokit({
            auth: accessToken,
        });
    }
    /**
     * Fetch all TypeScript/JavaScript files from a GitHub repository
     * without cloning it locally
     */
    async fetchRepositoryContent(repoUrl, sha = 'HEAD') {
        const { owner, repo } = this.parseRepoUrl(repoUrl);
        const repoId = this.generateUniqueRepoId(repoUrl);
        logger.info(`🔍 Fetching content for ${owner}/${repo} at ${sha}`);
        try {
            // Get the tree recursively
            const { data: tree } = await this.octokit.rest.git.getTree({
                owner,
                repo,
                tree_sha: sha,
                recursive: 'true', // Get all files recursively
            });
            const codeFiles = tree.tree.filter((item) => item.type === 'blob' &&
                item.path &&
                /\.(ts|tsx|js|jsx)$/.test(item.path) &&
                !item.path.includes('node_modules') &&
                !item.path.includes('dist/') &&
                !item.path.includes('.d.ts') // Skip type definitions
            );
            logger.info(`📁 Found ${codeFiles.length} code files`);
            // Fetch content for each file
            const fileResults = await Promise.all(codeFiles.map(async (file) => {
                try {
                    const { data: blob } = await this.octokit.rest.git.getBlob({
                        owner,
                        repo,
                        file_sha: file.sha,
                    });
                    // Decode base64 content
                    const content = Buffer.from(blob.content, 'base64').toString('utf-8');
                    return {
                        path: file.path,
                        content,
                        sha: file.sha,
                        size: file.size || 0,
                        type: 'file',
                    };
                }
                catch (error) {
                    logger.warn(`⚠️ Failed to fetch ${file.path}`, { error });
                    return null;
                }
            }));
            // Filter out failed fetches
            const validFiles = fileResults.filter((file) => file !== null);
            logger.info(`✅ Successfully fetched ${validFiles.length} files`);
            return {
                files: validFiles,
                repoId,
            };
        }
        catch (error) {
            logger.error('❌ Failed to fetch repository content', { error });
            throw new Error(`Failed to fetch repository: ${error}`);
        }
    }
    parseRepoUrl(url) {
        // Handle various GitHub URL formats:
        // https://github.com/owner/repo
        // https://github.com/owner/repo.git
        // git@github.com:owner/repo.git
        const match = url.match(/github\.com[/:]([\w-]+)\/([\w-]+)(?:\.git)?/);
        if (!match) {
            throw new Error(`Invalid GitHub URL: ${url}`);
        }
        return {
            owner: match[1],
            repo: match[2],
        };
    }
    generateUniqueRepoId(url) {
        return url
            .replace(/(^\w+:|^)\/\//, '')
            .replace(/\.git$/, '')
            .replace(/\W+/g, '_');
    }
}
