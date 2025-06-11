import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { GitHubApiError } from '../utils/error.utils.js';
import 'dotenv/config';
import { GITHUB_APP_PRIVATE_KEY } from '../../../config/auth.js';
// GitHub OAuth and App configurations
const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
const GITHUB_APP_CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID;
const GITHUB_APP_CLIENT_SECRET = process.env.GITHUB_APP_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI;
const REDIRECT_URI = 'https://devai-b2ui.onrender.com/api/auth/callback';
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
export async function exchangeCodeForToken(code) {
    const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: process.env.GITHUB_APP_CLIENT_ID,
            client_secret: process.env.GITHUB_APP_CLIENT_SECRET,
            code,
            redirect_uri: REDIRECT_URI, // ✅ if you're using this in GitHub settings
        }),
    });
    const data = await response.json();
    // ✅ LOG FULL RESPONSE FROM GITHUB
    console.log('[GitHub Token Exchange] Full response:', data);
    if (!data.access_token) {
        throw new Error('GitHub API Error: ' +
            (data.error_description || 'Failed to obtain access token'));
    }
    return data.access_token;
}
// Get GitHub user profile
export async function getGitHubUserProfile(accessToken) {
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
        throw new GitHubApiError('Failed to fetch user profile', response.status, data);
    }
    return data;
}
// Generate JWT for GitHub App authentication
export async function generateAppJwt() {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign({ iat: now - 60, exp: now + 600, iss: GITHUB_APP_ID }, GITHUB_APP_PRIVATE_KEY, {
        algorithm: 'RS256',
    });
}
// Get installation access token
export async function getInstallationToken(installationId) {
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
export async function fetchRepositories(installationToken) {
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
export async function fetchCommitInfo(repo, installationToken) {
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
export async function getRepositoriesWithMeta(installationId) {
    try {
        const installationToken = await getInstallationToken(installationId);
        const repositories = await fetchRepositories(installationToken);
        return Promise.all(repositories.map((repo) => fetchCommitInfo(repo, installationToken)));
    }
    catch (err) {
        console.error('Repository metadata fetch failed:', err);
        throw err;
    }
}
