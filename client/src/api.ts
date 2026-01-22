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

// Helper to get JWT token from localStorage
function getJWTToken(): string | null {
  return localStorage.getItem('jwt');
}

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
      throw new Error(
        'Authorization code expired. Please try logging in again.'
      );
    } else if (res.status === 400) {
      throw new Error(
        'Invalid authorization code. Please try logging in again.'
      );
    }
    throw new Error(`Auth failed: ${res.status} ${errorText}`);
  }

  const data = await res.json();

  // Verify token was stored (Safari sometimes has issues with localStorage)
  if (data.githubToken) {
    localStorage.setItem('githubToken', data.githubToken);
    const stored = localStorage.getItem('githubToken');
    if (stored !== data.githubToken) {
      console.error(
        '❌ WARNING: Token was not stored correctly in localStorage!'
      );
    }
  }
  if (data.token) {
    localStorage.setItem('jwt', data.token);
  }

  return data;
}

/**
 * Fetches the user's GitHub organizations so they can pick which one to work with.
 * 
 * This function is used by the org selector component to show the user all the organizations
 * they have access to. We're being smart about token handling here - we can accept a token
 * as a parameter (useful for testing or special cases), but we'll also check localStorage
 * as a fallback. This dual approach helps us work better with Safari, which can be picky
 * about how it handles cookies and localStorage.
 * 
 * @param token - Optional GitHub token. If not provided, we'll check localStorage instead.
 * @returns Promise resolving to an array of organizations the user can access
 */
export async function getUserOrgs(
  token?: string
): Promise<{ id: number; login: string }[]> {
  // Get the token from wherever we can find it - parameter first (if provided), then localStorage.
  // This flexibility helps us work around Safari's sometimes-unpredictable localStorage behavior.
  const githubToken = token || localStorage.getItem('githubToken');

  // Before we make any API calls, let's make sure we have a valid-looking token.
  // GitHub tokens are typically 40+ characters, so if we see something shorter than 20,
  // it's probably corrupted or incomplete. Better to catch this early and ask the user
  // to log in again rather than making a doomed API call!
  if (githubToken && githubToken.length < 20) {
    console.error('❌ Invalid token format detected, clearing...');
    // Clean up the bad tokens so we don't keep trying to use them
    localStorage.removeItem('githubToken');
    localStorage.removeItem('jwt');
    // Send the user back to login - they'll need fresh credentials
    window.location.href = `/login?expired=true`;
    throw new Error('Invalid token format');
  }

  const headers: HeadersInit = {
    'Cache-Control': 'no-cache', // We want fresh data, not cached org lists
  };

  // Safari has some quirks with cookies in cross-origin requests, so we send the token
  // in the Authorization header as well. This gives us the best compatibility across
  // all browsers. It's like having both a key and a backup key!
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const res = await fetch(`${API_BASE_URL}/auth/orgs`, {
    method: 'GET',
    credentials: 'include', // Still try to send cookies as fallback - belt and suspenders approach!
    headers,
  });

  // If we get a 401, the token has expired or been revoked. This isn't necessarily an error
  // on our part - users can revoke GitHub access anytime, or tokens can expire. Let's handle
  // it gracefully by cleaning up and redirecting to login.
  if (res.status === 401) {
    // Try to get a helpful error message from the backend, but don't fail if it's not JSON
    const errorData = await res.json().catch(() => ({ error: 'Token expired' }));
    console.warn('🔁 Token expired or invalid:', errorData);
    // Clean house - remove the bad tokens
    localStorage.removeItem('githubToken');
    localStorage.removeItem('jwt');
    // Send them back to login with a friendly message
    window.location.href = `/login?expired=true`;
    throw new Error(errorData.error || 'GitHub token expired — reauth required');
  }

  // If something else went wrong, let the caller know
  if (!res.ok) throw new Error(`Failed to fetch orgs: ${res.statusText}`);
  
  const data = await res.json();
  // Make sure we got what we expected - an array of orgs. If not, something went wrong
  // and we should let the caller know rather than returning unexpected data.
  if (!Array.isArray(data)) throw new Error('Invalid orgs response');
  return data;
}

//* promptbaringestion
export async function getIngestionStatus(
  jobId: string
): Promise<IngestionStatusData> {
  const res = await fetch(`${API_BASE_URL}/index/status/${jobId}`);
  if (!res.ok)
    throw new Error(`Failed to fetch ingestion status: ${res.statusText}`);
  return res.json();
}

//* repo-selector:
export async function getReposForOrg(opts: {
  org?: string;
  installation_id?: string;
}): Promise<Repo[]> {
  // Get token from localStorage for Safari compatibility
  const githubToken = localStorage.getItem('githubToken');

  const params = new URLSearchParams();
  if (opts.org) params.append('org', opts.org);
  if (opts.installation_id)
    params.append('installation_id', opts.installation_id);

  const headers: HeadersInit = {};

  // Send token in Authorization header for Safari compatibility
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const res = await fetch(
    `${API_BASE_URL}/auth/repos${
      params.toString() ? '?' + params.toString() : ''
    }`,
    {
      credentials: 'include', // Still try to send cookies as fallback
      headers,
    }
  );

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
export async function getRepoFileContent(
  repoUrl: string,
  filePath: string,
  token: string
): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${repoUrl}/contents/${filePath}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
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
  const headers: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  const url = `https://api.github.com/repos/${owner}/${repo}/contents${
    path ? '/' + path : ''
  }`;
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
  const jwtToken = getJWTToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };

  // Send JWT in Authorization header for Safari compatibility
  if (jwtToken) {
    headers.Authorization = `Bearer ${jwtToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/query/store`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
    credentials: 'include', // Still send cookies as fallback
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired, redirect to login
      localStorage.removeItem('jwt');
      localStorage.removeItem('githubToken');
      window.location.href = `/login?expired=true`;
    }
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
  const jwtToken = getJWTToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };

  // Send JWT in Authorization header for Safari compatibility
  if (jwtToken) {
    headers.Authorization = `Bearer ${jwtToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/query/question`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
    credentials: 'include', // Still send cookies as fallback
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired, redirect to login
      localStorage.removeItem('jwt');
      localStorage.removeItem('githubToken');
      window.location.href = `/login?expired=true`;
    }
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

/**
 * This helpful function retrieves the GitHub token from wherever we can find it!
 * 
 * Here's the situation: Safari can sometimes clear localStorage (especially in private browsing
 * mode or after certain security events), but it's usually more reliable with cookies. So we have
 * a smart two-step approach:
 * 
 * 1. First, we check localStorage - it's the fastest path and works great in most browsers.
 *    If we find it there, we're done! No need to make a network request.
 * 
 * 2. If localStorage comes up empty (maybe Safari cleared it, or maybe it was never there),
 *    we ask our backend for the token. The backend stores it in HTTP-only cookies, which Safari
 *    treats much more reliably. It's like having a backup copy in a safer location!
 * 
 * Once we get the token from the backend, we try to store it in localStorage again for next time.
 * If that fails (maybe the user is in strict privacy mode), that's okay - we still have the token
 * to use right now, and we'll just fetch it from the backend again next time.
 * 
 * This function is used throughout the app whenever we need the GitHub token, ensuring we always
 * have a reliable way to get it regardless of browser quirks!
 * 
 * @returns Promise resolving to the GitHub access token
 */
export async function getGithubToken(): Promise<string> {
  // First, let's check localStorage - it's the fastest path and works great in most browsers.
  // If we find the token here, we can return it immediately without making any network requests.
  // It's like checking your pocket for your keys before looking in the drawer!
  const cachedToken = localStorage.getItem('githubToken');
  if (cachedToken) {
    console.log('✅ Using cached GitHub token from localStorage');
    return cachedToken;
  }

  // Hmm, localStorage came up empty. This could happen for a few reasons:
  // - Safari cleared it (it does this sometimes, especially in private browsing)
  // - The user just logged in and the token hasn't been stored yet
  // - The token was manually cleared
  // 
  // No worries though! Our backend has a backup copy stored in HTTP-only cookies, which Safari
  // treats much more reliably. Let's ask the backend nicely for the token.
  console.log('⚠️ Token not in localStorage, fetching from backend...');

  const res = await fetch(`${API_BASE_URL}/auth/github-token`, {
    credentials: 'include', // Send cookies (Safari preserves these better than localStorage)
    headers: {
      'Cache-Control': 'no-cache', // We want fresh data, not a cached response
    },
  });

  // If we get a 401, the token has expired or been revoked. This isn't necessarily a problem
  // with our code - users can revoke GitHub access anytime. Let's handle it gracefully by
  // cleaning up and redirecting to login so they can get a fresh token.
  if (res.status === 401) {
    console.warn('🔁 Token expired, clearing localStorage...');
    // Clean up any stale tokens we might have
    localStorage.removeItem('githubToken');
    localStorage.removeItem('jwt');
    // Give the user a moment to see any error message, then redirect to login
    // The delay helps prevent jarring immediate redirects
    setTimeout(() => {
      window.location.href = `/login?expired=true`;
    }, 2000);
    throw new Error('GitHub token expired — reauth required');
  }

  // If something else went wrong (network error, server error, etc.), let the caller know
  if (!res.ok) {
    throw new Error('Failed to get token: ' + res.statusText);
  }

  const data = await res.json();
  // Make sure we actually got a token in the response - better to fail fast than return undefined!
  if (!data.token) {
    throw new Error('No GitHub token in response');
  }

  // Great! We got the token from the backend. Now let's try to store it in localStorage for
  // next time. This way, future calls can use the fast localStorage path instead of making
  // a network request. If storing fails (maybe the user is in strict privacy mode), that's
  // okay - we still have the token to use right now, and we'll just fetch it again next time.
  try {
    localStorage.setItem('githubToken', data.token);
    console.log('✅ Token retrieved from backend and stored in localStorage');
  } catch (storageError) {
    // This can happen in Safari's strict privacy mode or if localStorage is disabled.
    // It's not a critical error - we still have the token to use, we just can't cache it.
    console.warn(
      '⚠️ Failed to store token in localStorage (Safari privacy mode?):',
      storageError
    );
    // Continue anyway - we have the token to use right now, and that's what matters!
  }

  return data.token;
}
