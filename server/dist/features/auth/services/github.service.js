import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { GitHubApiError } from '../utils/error.utils.js';
import { GITHUB_APP_ID, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, GITHUB_REDIRECT_URI, GITHUB_APP_PRIVATE_KEY, } from '../../../config/env.validation.js';
import { logger } from '../../../utils/logger.js';
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
            client_id: GITHUB_APP_CLIENT_ID,
            client_secret: GITHUB_APP_CLIENT_SECRET,
            code,
            redirect_uri: GITHUB_REDIRECT_URI,
        }),
    });
    const data = await response.json();
    logger.debug('[GitHub Token Exchange] Response received', {
        hasAccessToken: !!data?.access_token,
        hasError: !!data?.error,
        error: data?.error,
    });
    if (!data.access_token) {
        const errorMsg = data.error_description || data.error || 'Failed to obtain access token';
        logger.warn('❌ GitHub token exchange failed', { errorMsg, data });
        // Check for specific error types
        if (errorMsg.includes('expired') ||
            errorMsg.includes('invalid') ||
            data.error === 'bad_verification_code') {
            throw new Error('Authorization code expired or already used. Please try logging in again.');
        }
        throw new Error('GitHub API Error: ' + errorMsg);
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
    const data = await response.json();
    logger.debug('📥 GitHub user profile fetched', {
        status: response.status,
        login: data?.login,
    });
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
// Fetch repositories for installation with pagination support
export async function fetchRepositories(installationToken) {
    const allRepositories = [];
    let page = 1;
    let hasMore = true;
    const perPage = 100; // Max allowed by GitHub API
    // Fetch all pages of repositories
    while (hasMore) {
        const response = await fetch(`https://api.github.com/installation/repositories?per_page=${perPage}&page=${page}`, {
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
        // Log response structure to debug
        logger.debug(`GitHub repos page ${page} response`, {
            hasRepositories: !!data.repositories,
            repositoriesCount: data.repositories?.length || 0,
            totalCount: data.total_count,
            responseKeys: Object.keys(data),
        });
        // Add repos from this page - GitHub API returns repos in data.repositories array
        if (data.repositories && data.repositories.length > 0) {
            allRepositories.push(...data.repositories);
            logger.debug(`Added ${data.repositories.length} repos from page ${page}`);
        }
        // Check if there are more pages by looking at the Link header
        // Note: node-fetch returns headers as a Headers object
        const linkHeader = response.headers.get('link') || response.headers.get('Link');
        logger.debug(`GitHub repos page ${page} Link header`, {
            linkHeader,
        });
        if (linkHeader && linkHeader.includes('rel="next"')) {
            page++;
            logger.debug(`More pages available, moving to page ${page}`);
        }
        else {
            hasMore = false;
            logger.debug('No more pages, stopping pagination');
        }
        // Also stop if we got fewer repos than per_page (means we're on last page)
        if (!data.repositories || data.repositories.length < perPage) {
            hasMore = false;
            logger.debug(`Got ${data.repositories?.length || 0} repos (less than ${perPage}), stopping`);
        }
    }
    logger.info(`Fetched ${allRepositories.length} total repositories`);
    return allRepositories;
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
        logger.info(`Processing ${repositories.length} repositories for commit info...`);
        // Fetch commit info for each repo, but don't fail if some fail
        const results = await Promise.allSettled(repositories.map((repo) => fetchCommitInfo(repo, installationToken)));
        // Filter out failed results and log them
        const successful = [];
        const failed = [];
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                successful.push(result.value);
            }
            else {
                failed.push({
                    repo: repositories[index]?.full_name || 'unknown',
                    error: result.reason,
                });
                logger.warn(`Failed to get commit info for ${repositories[index]?.full_name}`, { error: result.reason });
            }
        });
        logger.info(`Successfully processed ${successful.length} repos, ${failed.length} failed`);
        return successful;
    }
    catch (err) {
        logger.error('Repository metadata fetch failed', { err });
        throw err;
    }
}
