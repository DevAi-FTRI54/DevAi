// Contains controller functions for handling auth route requests and responses.
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import User from '../../../models/user.model.js';
import mongoose from 'mongoose';
import {
  exchangeCodeForToken,
  getGitHubUserProfile,
  getRepositoriesWithMeta,
} from '../services/github.service.js';
import {
  getAppInstallationUrl,
  checkIfAppInstalled,
  getAppInstallations,
} from '../services/installation.service.js';
import { findOrCreateUser } from '../services/user.service.js';
import { generateUserJWTToken } from '../services/jwt.service.js';
import { handleApiError } from '../utils/error.utils.js';
import 'dotenv/config';

console.log('Loading auth.controller.ts');

//Github OAuth credentials for the app NOT FOR THE USER!!!!
//Github code and access token are for users and are dynamic (Different Thing)
const GITHUB_APP_CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID!;
const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || 'http://localhost:5173';

console.log('🌍 Using frontend URL:', FRONTEND_BASE_URL);

// Circuit breaker pattern
let failureCount = 0;
let lastFailureTime = 0;
const MAX_FAILURES = 5;
const CIRCUIT_RESET_TIME = 30000; // 30 seconds

// Simple redirect to Github Oauth login
export const getGitHubLoginURL = (req: Request, res: Response) => {
  // const githubAuthURL = `https://github.com/login/oauth/authorize?client_id=${GITHUB_APP_CLIENT_ID}&redirect_uri=${encodeURIComponent(
  //   REDIRECT_URI
  // )}&scope=repo,read:org,user:email`;
  const githubAuthURL = `https://github.com/login/oauth/authorize?client_id=${GITHUB_APP_CLIENT_ID}&scope=read:org`;
  res.redirect(githubAuthURL);
};

// Process Github callback with auth code
export const handleGitHubCallback = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const code = req.query.code as string;
    if (!code) return res.status(400).send('Missing code');

    console.log('[GitHub OAuth] Received code:', code);

    // Step 1: Exchange code for access token
    const access_token = await exchangeCodeForToken(code);

    // Step 2: Get user profile
    const githubData = await getGitHubUserProfile(access_token);
    console.log(
      '✅ GitHub user profile fetched:',
      githubData.login || githubData
    );

    // Step 3: Create/find user in database
    const user = await findOrCreateUser(githubData, access_token);
    console.log('👤 DB user record:', user?.username);

    // Step 4: Generate JWT token
    const token = generateUserJWTToken({
      _id: user._id!.toString(),
      username: user.username,
    });

    // Step 5: Check GitHub App installation
    const installations = await getAppInstallations(access_token);
    const { isInstalled, installationId } = checkIfAppInstalled(installations);
    console.log(
      '🔧 GitHub App installed:',
      isInstalled,
      'Installation ID:',
      installationId
    );

    // Step 6: Set all cookies with environment-aware settings
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieSettings = {
      httpOnly: true,
      secure: isProduction, // Only require HTTPS in production
      sameSite: isProduction ? ('none' as const) : ('lax' as const), // Relaxed settings for development
    };

    res.cookie('github_access_token', access_token, cookieSettings);

    res.cookie('token', token, cookieSettings);

    if (installationId) {
      res.cookie('installation_id', installationId, cookieSettings);
    }

    // Step 7: Direct redirect based on installation status
    const redirectUrl = isInstalled
      ? `${FRONTEND_BASE_URL}/orgselector`
      : `${FRONTEND_BASE_URL}/install-github-app`;

    console.log(
      '🚀 Redirecting to:',
      redirectUrl,
      'at:',
      new Date().toISOString()
    );

    if (isInstalled) {
      return res.redirect(`${FRONTEND_BASE_URL}/orgselector`);
    } else {
      return res.redirect(`${FRONTEND_BASE_URL}/install-github-app`);
    }
  } catch (error: any) {
    console.error('❌ GitHub callback failed:', error);
    return res.redirect(
      `${FRONTEND_BASE_URL}/login?error=${encodeURIComponent(error.message)}`
    );
  }
};

// 2. Get GitHub response   OG!!!!!!
// export const completeAuth = async (
//   req: Request,
//   res: Response
// ): Promise<any> => {
//   try {
//     const githubToken = req.cookies.github_access_token;
//     if (!githubToken) return res.status(401).send('Missing GitHub token');

//     const githubData = await getGitHubUserProfile(githubToken);
//     const user = await findOrCreateUser(githubData, githubToken);

//     const token = generateUserJWTToken({
//       _id: user._id!.toString(),
//       username: user.username,
//     });
//     res.cookie('token', token, {
//       httpOnly: true,
//       secure: false, // 'dev' only
//       sameSite: 'lax',
//     });

//     // Check app installation status
//     console.log('--- user accessToken ---------');
//     console.log(user.accessToken);

//     const installations = await getAppInstallations(githubToken);
//     const { isInstalled, installationId } = checkIfAppInstalled(installations);

//     // Store the installation id for front-end to access the repos
//     if (installationId) {
//       res.cookie('installation_id', installationId, {
//         httpOnly: true,
//         sameSite: 'none', // <- must be 'none' for cross-origin cookies!
//         secure: true, // <- required for 'none'
//         domain: '.ngrok.app', // (optional, can be omitted, usually works w/o)
//       });
//     }

//     if (isInstalled) {
//       console.log('✅ GitHub App is installed');
//       return res.redirect(`${FRONTEND_BASE_URL}/orgselector`);
//     }
//     res.json({
//       token,
//       githubToken,
//       installed: isInstalled,
//       installationId,
//       needsInstall: !isInstalled,
//       // Add other flags/data if needed (e.g., orgs)
//     });
//   } catch (err) {
//     handleApiError(err, res, 'Authentication completion failed');
//   }
// };

export const completeAuth = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    let githubToken = req.cookies.github_access_token;
    console.log('🍪 GitHub token from cookie:', githubToken);
    // ❌ Don't re-use code to get another token
    if (!githubToken) {
      return res.status(401).send('Missing GitHub token');
    }
    console.log('📤 Calling getGitHubUserProfile() with token:', githubToken);
    const githubData = await getGitHubUserProfile(githubToken);
    console.log(
      '✅ GitHub user profile fetched:',
      githubData.login || githubData
    );
    const user = await findOrCreateUser(githubData, githubToken);
    console.log('👤 DB user record:', user?.username);
    const token = generateUserJWTToken({
      _id: user._id!.toString(),
      username: user.username,
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });

    const installations = await getAppInstallations(githubToken);
    const { isInstalled, installationId } = checkIfAppInstalled(installations);
    console.log(
      '🔧 GitHub App installed:',
      isInstalled,
      'Installation ID:',
      installationId
    );

    if (installationId) {
      res.cookie('installation_id', installationId, {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        // domain: '.ngrok.app', //! es removed 6/8
      });
    }

    res.json({
      token,
      githubToken,
      installed: isInstalled,
      installationId,
      needsInstall: !isInstalled,
    });
  } catch (err: any) {
    console.error('❌ Error in completeAuth:', err);
    handleApiError(err, res, 'Authentication completion failed');
  }
};

// Add this to your auth.controller.ts
// Simple in-memory cache for organizations (5 minutes TTL)
const orgCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Request deduplication: track in-flight requests
const inFlightRequests = new Map<string, Promise<any>>();

export const getGitHubUserOrgs = async (
  req: Request,
  res: Response
): Promise<void> => {
  const startTime = Date.now();
  console.log('⏱️ [ORGS] Request started at:', new Date().toISOString());

  try {
    const githubToken = req.cookies.github_access_token;
    if (!githubToken) {
      res.status(401).json({ error: 'Missing GitHub token' });
      return;
    }
    console.log('🔐 Using GitHub token:', githubToken.slice(0, 6), '...');

    const cacheKey = githubToken.slice(0, 10); // Use token prefix as cache key

    // Check cache first
    const cached = orgCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(
        `📦 [ORGS] Returning cached organizations (${Date.now() - startTime}ms)`
      );
      res.json(cached.data);
      return;
    }

    // Check if there's already an in-flight request for this user
    const requestKey = `orgs_${cacheKey}`;
    if (inFlightRequests.has(requestKey)) {
      console.log('🔄 [ORGS] Waiting for existing request...');
      const result = await inFlightRequests.get(requestKey);
      console.log(
        `✅ [ORGS] Got result from existing request (${
          Date.now() - startTime
        }ms)`
      );
      res.json(result);
      return;
    }

    // Create new request promise
    const fetchPromise = (async () => {
      console.log('🌐 [ORGS] Making fresh GitHub API call...');
      const apiStartTime = Date.now();

      const response = await fetch('https://api.github.com/user/orgs', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          'User-Agent': 'YourAppName',
          Accept: 'application/vnd.github+json',
        },
      });

      console.log(
        `📡 [ORGS] GitHub API responded in ${Date.now() - apiStartTime}ms`
      );

      if (!response.ok) throw new Error('Failed to fetch orgs');
      const orgs = (await response.json()) as {
        id: number;
        login: string;
        avatar_url: string;
      }[];

      // Process and cache the data
      const processedOrgs = orgs.map(({ id, login, avatar_url }) => ({
        id,
        login,
        avatar_url,
      }));
      orgCache.set(cacheKey, { data: processedOrgs, timestamp: Date.now() });

      console.log(`✅ [ORGS] Processed ${processedOrgs.length} organizations`);
      return processedOrgs;
    })();

    // Store the promise to deduplicate concurrent requests
    inFlightRequests.set(requestKey, fetchPromise);

    try {
      const result = await fetchPromise;
      console.log(`🎉 [ORGS] Total request time: ${Date.now() - startTime}ms`);
      res.json(result);
    } finally {
      // Clean up the in-flight request
      inFlightRequests.delete(requestKey);
    }
  } catch (err: Error | any) {
    console.error(
      `❌ [ORGS] Error after ${Date.now() - startTime}ms:`,
      err.message
    );
    res
      .status(500)
      .json({ error: 'Failed to fetch orgs', detail: err.message });
  }
};

// 3. List repos
export const listRepos = async (req: Request, res: Response): Promise<void> => {
  if (failureCount >= MAX_FAILURES) {
    // Check if enough time has passed to reset
    const now = Date.now();
    if (!lastFailureTime || now - lastFailureTime > CIRCUIT_RESET_TIME) {
      console.log('🔄 Resetting circuit breaker');
      failureCount = 0;
    } else {
      res.status(503).json({
        error: 'Service temporarily unavailable',
        retry: true,
        retryAfter: Math.ceil(
          (CIRCUIT_RESET_TIME - (now - lastFailureTime)) / 1000
        ),
      });
      return;
    }
  }

  try {
    if (!mongoose.connection.readyState) {
      res.status(503).json({ error: 'Database not ready' });
      return;
    }
    //*ES Removed 6/7.
    // const installationId = req.cookies.installation_id;
    // if (!installationId) {
    //   res.status(400).send('No installation_id');
    //   return;
    // }

    // Read org login from query
    const org = req.query.org as string | undefined;
    let installationId = req.cookies.installation_id;

    if (org) {
      const githubToken = req.cookies.github_access_token;
      if (!githubToken) {
        res.status(401).json({ error: 'Missing GitHub token' });
        return;
      }
      const installationsResult = await getAppInstallations(githubToken);
      console.log('installationsResult:', installationsResult);
      const installations = Array.isArray(installationsResult)
        ? installationsResult
        : installationsResult.installations || [];

      if (!installations || installations.length === 0) {
        res.status(404).json({ error: 'No installations found for this user' });
        return;
      }
      const match = installations.find(
        (inst: any) =>
          inst.account &&
          inst.account.login &&
          inst.account.login.toLowerCase() === org.toLowerCase()
      );
      if (!match) {
        res.status(404).json({ error: 'App not installed on this org' });
        return;
      }
      installationId = match.id;
    }

    //*ES 6/7
    // // If org specified, look up installationId for that org
    // if (org) {
    //   // Get all installations for this user (token from cookies)
    //   const githubToken = req.cookies.github_access_token;
    //   if (!githubToken) {
    //     res.status(401).json({ error: 'Missing GitHub token' });
    //     return;
    //   }
    //   // Get all installations for user
    //   const installations = await getAppInstallations(githubToken);
    //   console.log('🐲🐲🐲installations from getAppInstallations:', installations);

    //   // Find the installation for the selected org
    //   const match = installations.find(
    //     (inst: any) => inst.account && inst.account.login && inst.account.login.toLowerCase() === org.toLowerCase()
    //   );
    //   if (!match) {
    //     res.status(404).json({ error: 'App not installed on this org' });
    //     return;
    //   }
    //   installationId = match.id;
    // }

    if (!installationId) {
      res.status(400).send('No installation_id');
      return;
    }

    // This call is correct as long as getRepositoriesWithMeta fetches for a specific installationId
    const repositories = await getRepositoriesWithMeta(installationId);

    failureCount = 0;
    lastFailureTime = 0;

    res.json(repositories);
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ENOTFOUND')) {
      failureCount++;
      lastFailureTime = Date.now();
    }

    handleApiError(error, res);
  }
};

// 4. Get githubToken and pass to chatwrap.tsx
export const getGithubToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  if (!mongoose.connection.readyState) {
    res.status(503).json({ error: 'Database not ready', ready: true });
    return;
  }

  const githubToken = req.cookies.github_access_token;
  if (!githubToken) {
    res.status(401).json({ error: 'Failed to get Github token' });
    return;
  }

  res.json({ token: githubToken });
};

//Logout function

export const logout = (req: Request, res: Response) => {
  res.clearCookie('github_access_token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  });

  res.clearCookie('token', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
  });

  res.clearCookie('installation_id', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  });

  res.status(200).json({ message: 'Logged out successfully' });
};
