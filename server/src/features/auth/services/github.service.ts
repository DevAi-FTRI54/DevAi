import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { GitHubApiError } from '../utils/error.utils.js';
import 'dotenv/config';
import { GITHUB_APP_PRIVATE_KEY } from '../../../config/auth.js';

// GitHub OAuth and App configurations
const GITHUB_APP_ID = process.env.GITHUB_APP_ID!;
const GITHUB_APP_CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID!;
const GITHUB_APP_CLIENT_SECRET = process.env.GITHUB_APP_CLIENT_SECRET!;
// const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY!.replace(
//   /\\n/g,
//   '\n'
// );

const REDIRECT_URI =
  process.env.REDIRECT_URI || 'http://localhost:4000/api/auth/callback';

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
export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GITHUB_APP_CLIENT_ID,
      client_secret: GITHUB_APP_CLIENT_SECRET,
      code,
    }),
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new GitHubApiError('Failed to obtain access token', response.status);
  }

  return data.access_token;
}

// Get GitHub user profile
export async function getGitHubUserProfile(accessToken: string): Promise<any> {
  const response = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new GitHubApiError('Failed to fetch user profile', response.status, data);
  }

  return data;
}

// Generate JWT for GitHub App authentication
export async function generateAppJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({ iat: now - 60, exp: now + 600, iss: GITHUB_APP_ID }, GITHUB_APP_PRIVATE_KEY, {
    algorithm: 'RS256',
  });
}

// Get installation access token
export async function getInstallationToken(installationId: string): Promise<string> {
  const jwtToken = await generateAppJwt();

  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new GitHubApiError('Failed to get installation token', response.status, data);
  }

  return data.token;
}

// Fetch repositories for installation
export async function fetchRepositories(installationToken: string): Promise<any[]> {
  const response = await fetch('https://api.github.com/installation/repositories', {
    headers: {
      Authorization: `token ${installationToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new GitHubApiError('Failed to fetch repositories', response.status, data);
  }

  return data.repositories;
}

// Get commit information for a repository
export async function fetchCommitInfo(repo: Repository, installationToken: string): Promise<RepositoryWithMeta> {
  const response = await fetch(`https://api.github.com/repos/${repo.full_name}/commits/${repo.default_branch}`, {
    headers: {
      Authorization: `token ${installationToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new GitHubApiError('Failed to fetch commit info', response.status, data);
  }

  return {
    id: repo.id,
    full_name: repo.full_name,
    html_url: repo.html_url,
    sha: data.sha,
  };
}

// Get repositories with additional metadata
export async function getRepositoriesWithMeta(installationId: string): Promise<RepositoryWithMeta[]> {
  try {
    const installationToken = await getInstallationToken(installationId);
    const repositories = await fetchRepositories(installationToken);

    return Promise.all(repositories.map((repo) => fetchCommitInfo(repo, installationToken)));
  } catch (err) {
    console.error('Repository metadata fetch failed:', err);
    throw err;
  }
}
