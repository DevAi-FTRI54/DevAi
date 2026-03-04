import type { IngestionStatusData } from './components/auth/promptbaringeststatus';
import type { Repo } from './types';
import type { GitHubContentItem } from './types';
import type { ChatHistoryEntry } from './types';

// api.ts or apiHelpers.ts

// SINGLE consistent variable at the top
// Use environment variable, fallback to Render URL for production
const isProduction = import.meta.env.PROD;
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (isProduction ? 'https://devai-b2ui.onrender.com/api' : '');

// client/src/api.ts
console.log('🔧 Environment check:', {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  NODE_ENV: import.meta.env.NODE_ENV,
  all_env: import.meta.env,
});

// Cookies-only: tokens live in HTTP-only cookies; client never reads or stores them.

//* AuthCallback.tsx: complete auth; server sets HTTP-only cookies, we do not store tokens.
export async function completeAuth(code: string) {
  const res = await fetch(`${API_BASE_URL}/auth/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
    credentials: 'include',
  });

  if (!res.ok) {
    const errorText = await res.text();
    if (errorText.includes('expired') || res.status === 401) {
      throw new Error(
        'Authorization code expired. Please try logging in again.',
      );
    } else if (res.status === 400) {
      throw new Error(
        'Invalid authorization code. Please try logging in again.',
      );
    }
    throw new Error(`Auth failed: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  return data;
}

//* orgselector.tsx — auth via cookie only
export async function getUserOrgs(): Promise<{ id: number; login: string }[]> {
  const res = await fetch(`${API_BASE_URL}/auth/orgs`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Cache-Control': 'no-cache' },
  });

  if (res.status === 401) {
    window.location.href = '/login?expired=true';
    throw new Error('Session expired — reauth required');
  }

  if (!res.ok) throw new Error(`Failed to fetch orgs: ${res.statusText}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Invalid orgs response');
  return data;
}

//* promptbaringestion
export async function getIngestionStatus(
  jobId: string,
): Promise<IngestionStatusData> {
  const res = await fetch(`${API_BASE_URL}/index/status/${jobId}`, {
    credentials: 'include',
  });
  if (!res.ok)
    throw new Error(`Failed to fetch ingestion status: ${res.statusText}`);
  return res.json();
}

//* repo-selector — auth via cookie only
export async function getReposForOrg(opts: {
  org?: string;
  installation_id?: string;
}): Promise<Repo[]> {
  const params = new URLSearchParams();
  if (opts.org) params.append('org', opts.org);
  if (opts.installation_id)
    params.append('installation_id', opts.installation_id);

  const res = await fetch(
    `${API_BASE_URL}/auth/repos${params.toString() ? '?' + params.toString() : ''}`,
    { credentials: 'include' },
  );

  if (res.status === 401) {
    window.location.href = '/login?expired=true';
    throw new Error('Session expired — reauth required');
  }

  if (!res.ok) throw res;
  return res.json();
}

export async function startRepoIngestion(opts: {
  repoUrl: string;
  sha: string;
  installation_id?: string;
}): Promise<{ jobId: string }> {
  const res = await fetch(`${API_BASE_URL}/index/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Ingestion failed');
  return res.json();
}

// Fetch file content via backend proxy (cookie auth; client never sees token).
export async function getRepoFileContent(
  repoUrl: string,
  filePath: string,
): Promise<string> {
  const params = new URLSearchParams({ repoUrl, filePath });
  const res = await fetch(
    `${API_BASE_URL}/auth/github-file-content?${params}`,
    {
      credentials: 'include',
    },
  );
  if (!res.ok) throw new Error('Failed to fetch file');
  const data = await res.json();
  return data.content ?? '';
}

// Fetch repo contents (directory listing) via backend proxy (cookie auth).
export async function getRepoContents(
  owner: string,
  repo: string,
  path: string = '',
): Promise<GitHubContentItem[]> {
  const params = new URLSearchParams({ owner, repo });
  if (path) params.append('path', path);
  const res = await fetch(
    `${API_BASE_URL}/auth/github-repo-contents?${params}`,
    {
      credentials: 'include',
    },
  );
  if (!res.ok) throw new Error(`GitHub fetch failed: ${res.statusText}`);
  return res.json();
}

//* If these are also your backend routes, update them to use API_BASE_URL:
export async function getChatHistory(): Promise<ChatHistoryEntry[]> {
  const res = await fetch(`${API_BASE_URL}/chat/history/flat`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data))
    throw new Error('Invalid response format: expected an array');
  return data;
}

export async function storeUserMessage(data: {
  sessionId: string;
  role: string;
  content: string;
  repoUrl: string;
  timestamp: Date;
}): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/query/store`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) window.location.href = '/login?expired=true';
    throw new Error('Failed to store user message');
  }
  return true;
}

export async function postUserPrompt(data: {
  url: string;
  prompt: string;
  type: string;
  sessionId: string;
}): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}/query/question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) window.location.href = '/login?expired=true';
    throw new Error('Failed to submit prompt');
  }
  return response;
}

//* Logout
export async function logoutUser(): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

// Fetch current user for display only (server reads JWT from cookie; no token in response).
export async function getCurrentUserFromApi(): Promise<{
  userId: string;
  githubUsername: string;
} | null> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: 'include',
  });
  if (res.status === 401 || !res.ok) return null;
  return res.json();
}

// Cookies-only: verify session (server has token in HTTP-only cookie). Throws if not authenticated.
export async function checkSession(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/github-token`, {
    credentials: 'include',
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (res.status === 401) {
    window.location.href = '/login?expired=true';
    throw new Error('Session expired — reauth required');
  }
  if (!res.ok) throw new Error('Session check failed: ' + res.statusText);
}
