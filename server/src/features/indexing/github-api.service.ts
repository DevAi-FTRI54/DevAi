// GitHub API service for fetching repository content without cloning
import { Octokit } from 'octokit';

interface GitHubFile {
  path: string;
  content: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
}

interface RepositoryContent {
  files: GitHubFile[];
  repoId: string;
}

export class GitHubApiService {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({
      auth: accessToken,
    });
  }

  /**
   * Fetch all TypeScript/JavaScript files from a GitHub repository
   * without cloning it locally
   */
  async fetchRepositoryContent(
    repoUrl: string,
    sha = 'HEAD'
  ): Promise<RepositoryContent> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    const repoId = this.generateUniqueRepoId(repoUrl);
    
    console.log(`🔍 Fetching content for ${owner}/${repo} at ${sha}`);

    try {
      // Get the tree recursively
      const { data: tree } = await this.octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: sha,
        recursive: 'true', // Get all files recursively
      });

      // Filter for TypeScript/JavaScript files
      const codeFiles = tree.tree.filter(
        (item) =>
          item.type === 'blob' &&
          item.path &&
          /\.(ts|tsx|js|jsx)$/.test(item.path) &&
          !item.path.includes('node_modules') &&
          !item.path.includes('dist/') &&
          !item.path.includes('.d.ts') // Skip type definitions
      );

      console.log(`📁 Found ${codeFiles.length} code files`);

      // Fetch content for each file
      const fileResults = await Promise.all(
        codeFiles.map(async (file): Promise<GitHubFile | null> => {
          try {
            const { data: blob } = await this.octokit.rest.git.getBlob({
              owner,
              repo,
              file_sha: file.sha!,
            });

            // Decode base64 content
            const content = Buffer.from(blob.content, 'base64').toString('utf-8');

            return {
              path: file.path!,
              content,
              sha: file.sha!,
              size: file.size || 0,
              type: 'file' as const,
            };
          } catch (error) {
            console.warn(`⚠️ Failed to fetch ${file.path}:`, error);
            return null;
          }
        })
      );

      // Filter out failed fetches
      const validFiles = fileResults.filter((file): file is GitHubFile => file !== null);
      
      console.log(`✅ Successfully fetched ${validFiles.length} files`);

      return {
        files: validFiles,
        repoId,
      };
    } catch (error) {
      console.error('❌ Failed to fetch repository content:', error);
      throw new Error(`Failed to fetch repository: ${error}`);
    }
  }

  private parseRepoUrl(url: string): { owner: string; repo: string } {
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

  private generateUniqueRepoId(url: string): string {
    return url
      .replace(/(^\w+:|^)\/\//, '')
      .replace(/\.git$/, '')
      .replace(/\W+/g, '_');
  }
}
