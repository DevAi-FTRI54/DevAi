import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { GitHubApiError } from '../utils/error.utils.js';
import 'dotenv/config';
import { GITHUB_APP_PRIVATE_KEY } from '../../../config/auth.js';

// GitHub OAuth and App configurations
const GITHUB_APP_ID = process.env.GITHUB_APP_ID!;
const GITHUB_APP_CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID!;
const GITHUB_APP_CLIENT_SECRET = process.env.GITHUB_APP_CLIENT_SECRET!;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI!;
const REDIRECT_URI = 'https://devai-b2ui.onrender.com/api/auth/callback';
// const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY!.replace(
//   /\\n/g,
//   '\n'
// );

// const REDIRECT_URI =
//   process.env.REDIRECT_URI || 'http://localhost:4000/api/auth/callback';

// Add specific types for repository objects:
interface Repository {
  id: number;
  full_name: string;
  html_url: string;
  default_branch: string;
  [key: string]: any;
}

interface RepositoryWithMeta {
  id: number;
  full_name: string;
  html_url: string;
  sha: string;
}

// Exchange OAuth code for access token
// export async function exchangeCodeForToken(code: string): Promise<string> {
//   const response = await fetch('https://github.com/login/oauth/access_token', {
//     method: 'POST',
//     headers: {
//       Accept: 'application/json',
//       'Content-Type': 'application/x-www-form-urlencoded',
//     },
//     body: new URLSearchParams({
//       client_id: GITHUB_APP_CLIENT_ID,
//       client_secret: GITHUB_APP_CLIENT_SECRET,
//       code,
//       redirect_uri: GITHUB_REDIRECT_URI,
//     }),
//   });

export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.GITHUB_APP_CLIENT_ID!,
      client_secret: process.env.GITHUB_APP_CLIENT_SECRET!,
      code,
      redirect_uri: REDIRECT_URI, // ✅ if you're using this in GitHub settings
    }),
  });

  const data = await response.json();

  // ✅ LOG FULL RESPONSE FROM GITHUB
  console.log('[GitHub Token Exchange] Full response:', data);

  if (!data.access_token) {
    const errorMsg = data.error_description || data.error || 'Failed to obtain access token';
    console.error('❌ GitHub token exchange failed:', errorMsg);
    
    // Check for specific error types
    if (errorMsg.includes('expired') || errorMsg.includes('invalid') || data.error === 'bad_verification_code') {
      throw new Error('Authorization code expired or already used. Please try logging in again.');
    }
    
    throw new Error('GitHub API Error: ' + errorMsg);
  }

  return data.access_token;
}

// Get GitHub user profile
export async function getGitHubUserProfile(accessToken: string): Promise<any> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `token ${accessToken}`, // 👈 fix is here
      Accept: 'application/vnd.github+json', // optional but good practice
    },
  });
  console.log('📥 GitHub user response status:', response.status);
  const data = await response.json();
  console.log('📄 GitHub user profile data:', data);
  if (!response.ok) {
    throw new GitHubApiError(
      'Failed to fetch user profile',
      response.status,
      data
    );
  }

  return data;
}

// Generate JWT for GitHub App authentication
export async function generateAppJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iat: now - 60, exp: now + 600, iss: GITHUB_APP_ID },
    GITHUB_APP_PRIVATE_KEY,
    {
      algorithm: 'RS256',
    }
  );
}

// Get installation access token
export async function getInstallationToken(
  installationId: string
): Promise<string> {
  const jwtToken = await generateAppJwt();

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new GitHubApiError(
      'Failed to get installation token',
      response.status,
      data
    );
  }

  return data.token;
}

// Fetch repositories for installation with pagination support
export async function fetchRepositories(
  installationToken: string
): Promise<any[]> {
  const allRepositories: any[] = [];
  let page = 1;
  let hasMore = true;
  const perPage = 100; // Max allowed by GitHub API

  // Fetch all pages of repositories
  while (hasMore) {
  const response = await fetch(
      `https://api.github.com/installation/repositories?per_page=${perPage}&page=${page}`,
    {
      headers: {
        Authorization: `token ${installationToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new GitHubApiError(
      'Failed to fetch repositories',
      response.status,
      data
    );
  }

    // Log response structure to debug
    console.log(`Page ${page} response:`, {
      hasRepositories: !!data.repositories,
      repositoriesCount: data.repositories?.length || 0,
      totalCount: data.total_count,
      responseKeys: Object.keys(data),
    });

    // Add repos from this page - GitHub API returns repos in data.repositories array
    if (data.repositories && data.repositories.length > 0) {
      allRepositories.push(...data.repositories);
      console.log(`Added ${data.repositories.length} repos from page ${page}`);
    }

    // Check if there are more pages by looking at the Link header
    // Note: node-fetch returns headers as a Headers object
    const linkHeader = response.headers.get('link') || response.headers.get('Link');
    console.log(`Page ${page} Link header:`, linkHeader);
    
    if (linkHeader && linkHeader.includes('rel="next"')) {
      page++;
      console.log(`More pages available, moving to page ${page}`);
    } else {
      hasMore = false;
      console.log(`No more pages, stopping pagination`);
    }

    // Also stop if we got fewer repos than per_page (means we're on last page)
    if (!data.repositories || data.repositories.length < perPage) {
      hasMore = false;
      console.log(`Got ${data.repositories?.length || 0} repos (less than ${perPage}), stopping`);
    }
  }

  console.log(`Fetched ${allRepositories.length} total repositories`);
  return allRepositories;
}

// Get commit information for a repository
export async function fetchCommitInfo(
  repo: Repository,
  installationToken: string
): Promise<RepositoryWithMeta> {
  const response = await fetch(
    `https://api.github.com/repos/${repo.full_name}/commits/${repo.default_branch}`,
    {
      headers: {
        Authorization: `token ${installationToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new GitHubApiError(
      'Failed to fetch commit info',
      response.status,
      data
    );
  }

  return {
    id: repo.id,
    full_name: repo.full_name,
    html_url: repo.html_url,
    sha: data.sha,
  };
}

// Get repositories with additional metadata
export async function getRepositoriesWithMeta(
  installationId: string
): Promise<RepositoryWithMeta[]> {
  try {
    const installationToken = await getInstallationToken(installationId);
    const repositories = await fetchRepositories(installationToken);

    console.log(`Processing ${repositories.length} repositories for commit info...`);

    // Fetch commit info for each repo, but don't fail if some fail
    const results = await Promise.allSettled(
      repositories.map((repo) => fetchCommitInfo(repo, installationToken))
    );

    // Filter out failed results and log them
    const successful: RepositoryWithMeta[] = [];
    const failed: any[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push(result.value);
      } else {
        failed.push({
          repo: repositories[index]?.full_name || 'unknown',
          error: result.reason,
        });
        console.warn(`Failed to get commit info for ${repositories[index]?.full_name}:`, result.reason);
      }
    });

    console.log(`Successfully processed ${successful.length} repos, ${failed.length} failed`);
    return successful;
  } catch (err) {
    console.error('Repository metadata fetch failed:', err);
    throw err;
  }
}
