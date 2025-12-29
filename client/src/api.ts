import type { IngestionStatusData } from './components/auth/promptbaringeststatus';
import type { Repo } from './types';
import type { GitHubContentItem } from './types';
import type { ChatHistoryEntry } from './types';

// api.ts or apiHelpers.ts

// SINGLE consistent variable at the top
// Use environment variable, fallback to Render URL for production
const isProduction = import.meta.env.PROD;
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (isProduction ? 'https://devai-b2ui.onrender.com/api' : '');

// client/src/api.ts
console.log('🔧 Environment check:', {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  NODE_ENV: import.meta.env.NODE_ENV,
  all_env: import.meta.env,
});

//* AuthCallback.tsx get
export async function completeAuth(code: string) {
  const res = await fetch(`${API_BASE_URL}/auth/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
    credentials: 'include', // Required for Safari to send cookies
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    // Check for specific error messages
    if (errorText.includes('expired') || res.status === 401) {
      throw new Error('Authorization code expired. Please try logging in again.');
    } else if (res.status === 400) {
      throw new Error('Invalid authorization code. Please try logging in again.');
    }
    throw new Error(`Auth failed: ${res.status} ${errorText}`);
  }
  
  const data = await res.json();
  
  // Verify token was stored (Safari sometimes has issues with localStorage)
  if (data.githubToken) {
    localStorage.setItem('githubToken', data.githubToken);
    const stored = localStorage.getItem('githubToken');
    if (stored !== data.githubToken) {
      console.error('❌ WARNING: Token was not stored correctly in localStorage!');
    }
  }
  if (data.token) {
    localStorage.setItem('jwt', data.token);
  }
  
  return data;
}

//* orgselector.tsx
export async function getUserOrgs(token?: string): Promise<{ id: number; login: string }[]> {
  // Get token from parameter or localStorage (for Safari compatibility)
  const githubToken = token || localStorage.getItem('githubToken');
  
  const headers: HeadersInit = {
    'Cache-Control': 'no-cache',
  };
  
  // Send token in Authorization header for Safari compatibility
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }
  
  const res = await fetch(`${API_BASE_URL}/auth/orgs`, {
    method: 'GET',
    credentials: 'include', // Still try to send cookies as fallback
    headers,
  });

  if (res.status === 401) {
    console.warn('🔁 Token expired, redirecting to login...');
    localStorage.removeItem('githubToken');
    localStorage.removeItem('jwt');
    window.location.href = `/login?expired=true`;
    throw new Error('GitHub token expired — reauth required');
  }

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
export async function getReposForOrg(opts: { org?: string; installation_id?: string }): Promise<Repo[]> {
  // Get token from localStorage for Safari compatibility
  const githubToken = localStorage.getItem('githubToken');
  
  const params = new URLSearchParams();
  if (opts.org) params.append('org', opts.org);
  if (opts.installation_id) params.append('installation_id', opts.installation_id);

  const headers: HeadersInit = {};
  
  // Send token in Authorization header for Safari compatibility
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const res = await fetch(`${API_BASE_URL}/auth/repos${params.toString() ? '?' + params.toString() : ''}`, {
    credentials: 'include', // Still try to send cookies as fallback
    headers,
  });

  if (res.status === 401) {
    console.warn('🔁 Token expired, redirecting to login...');
    localStorage.removeItem('githubToken');
    localStorage.removeItem('jwt');
    window.location.href = `/login?expired=true`;
    throw new Error('GitHub token expired — reauth required');
  }

  if (!res.ok) {
    throw res;
  }
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
  });
  if (!res.ok) throw new Error('Ingestion failed');
  return res.json();
}

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

//* Calls to GitHub stay the same (they don't use your API_BASE_URL):
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

//* If these are also your backend routes, update them to use API_BASE_URL:
export async function getChatHistory(): Promise<ChatHistoryEntry[]> {
  const res = await fetch(`${API_BASE_URL}/chat/history/flat`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Invalid response format: expected an array');
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

  if (!response.ok) throw new Error('Failed to store user message');
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
  if (!response.ok) throw new Error('Failed to submit prompt');
  return response;
}

//* Logout
export async function logoutUser(): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

//* Chatwrap helper function
export async function getGithubToken(): Promise<string> {
  // First, check if we have token in localStorage (fastest path)
  const cachedToken = localStorage.getItem('githubToken');
  if (cachedToken) {
    console.log('✅ Using cached GitHub token from localStorage');
    return cachedToken;
  }
  
  // If not in localStorage (Safari might have cleared it), try to get from backend
  // Backend has it in cookies which Safari preserves better
  console.log('⚠️ Token not in localStorage, fetching from backend...');
  
  const res = await fetch(`${API_BASE_URL}/auth/github-token`, {
    credentials: 'include', // Send cookies (Safari preserves these better)
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
  
  if (res.status === 401) {
    console.warn('🔁 Token expired, clearing localStorage...');
    localStorage.removeItem('githubToken');
    localStorage.removeItem('jwt');
    // Redirect to login after a short delay to show error message
    setTimeout(() => {
      window.location.href = `/login?expired=true`;
    }, 2000);
    throw new Error('GitHub token expired — reauth required');
  }
  
  if (!res.ok) {
    throw new Error('Failed to get token: ' + res.statusText);
  }
  
  const data = await res.json();
  if (!data.token) {
    throw new Error('No GitHub token in response');
  }
  
  // Store token in localStorage for future use (Safari might have cleared it)
  try {
    localStorage.setItem('githubToken', data.token);
    console.log('✅ Token retrieved from backend and stored in localStorage');
  } catch (storageError) {
    console.warn('⚠️ Failed to store token in localStorage (Safari privacy mode?):', storageError);
    // Continue anyway - we have the token to use
  }
  
  return data.token;
}
