import type { IngestionStatusData } from './components/auth/promptbaringeststatus';
import type { Repo } from './types';
import type { GitHubContentItem } from './types';
import type { ChatHistoryEntry } from './types';

const API_BASE_URL = import.meta.env.VITE_APIL_URL || 'http://localhost:4000/api';

//* AuthCallback.tsx get
export async function completeAuth(code: string) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Auth failed');
  return res.json();
}

//* orgselector.tsx
// This should accept `token: string` as a parameter:
export async function getUserOrgs(token: string): Promise<{ id: number; login: string }[]> {
  const res = await fetch(`${API_BASE_URL}/auth/orgs`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Cache-Control': 'no-cache',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch orgs: ${res.statusText}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Invalid orgs response');
  return data;
}

//* promptbaringestion

export async function getIngestionStatus(jobId: string): Promise<IngestionStatusData> {
  const res = await fetch(`${API_BASE_URL}/index/status/${jobId}`);
  if (!res.ok) throw new Error(`Failed to fetch ingestion status: ${res.statusText}`);
  return res.json();
}

//* repo-selector:

// 1. Fetch repos for org/installation
export async function getReposForOrg(opts: { org?: string; installation_id?: string }): Promise<Repo[]> {
  const params = new URLSearchParams();
  if (opts.org) params.append('org', opts.org);
  if (opts.installation_id) params.append('installation_id', opts.installation_id);

  const res = await fetch(`${API_BASE_URL}/auth/repos${params.toString() ? '?' + params.toString() : ''}`, {
    credentials: 'include',
  });

  if (!res.ok) {
    throw res;
  }
  return res.json();
}

// 2. Start ingestion
export async function startRepoIngestion(opts: {
  repoUrl: string;
  sha: string;
  installation_id?: string;
}): Promise<{ jobId: string }> {
  const res = await fetch(`${API_BASE_URL}/index/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error('Ingestion failed');
  return res.json();
}

//*sidebarDrawer.tsx
export async function getRepoContents(
  owner: string,
  repo: string,
  path: string = '',
  token?: string
): Promise<GitHubContentItem[]> {
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  const url = `https://api.github.com/repos/${owner}/${repo}/contents${path ? '/' + path : ''}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub fetch failed: ${res.statusText}`);
  return res.json();
}

//* ChatHistory
export async function getChatHistory(): Promise<ChatHistoryEntry[]> {
  const res = await fetch('/api/chat/history/flat', {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Invalid response format: expected an array');
  return data;
}

//* ChatInput
// Store a user message
export async function storeUserMessage(data: {
  sessionId: string;
  role: string;
  content: string;
  repoUrl: string;
  timestamp: Date;
}): Promise<boolean> {
  const response = await fetch('/api/query/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error('Failed to store user message');
  return true;
}

// Start a question (AI response) - streaming support is handled in the component
export async function postUserPrompt(data: {
  url: string;
  prompt: string;
  type: string;
  sessionId: string;
}): Promise<Response> {
  const response = await fetch('/api/query/question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to submit prompt');
  return response; // Streaming will be handled in the component, as before
}

//* filepreview
// Fetch file content from GitHub, decode base64
export async function getRepoFileContent(repoUrl: string, filePath: string, token: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${repoUrl}/contents/${filePath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch file');
  const data = await res.json();
  // GitHub returns content as base64
  return atob(data.content.replace(/\n/g, ''));
}

//* Logout
export async function logoutUser(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}
