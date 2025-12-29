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
// export const handleGitHubCallback = async (
//   req: Request,
//   res: Response
// ): Promise<any> => {
//   try {
//     const code = req.query.code as string;
//     if (!code) return res.status(400).send('Missing code');

//     // ✅ Do NOT call exchangeCodeForToken again if it was already used
//     console.log('[GitHub OAuth] Received code:', code);

//     const access_token = await exchangeCodeForToken(code);

//     res.cookie('github_access_token', access_token, {
//       httpOnly: true,
//       secure: true,
//       sameSite: 'none',
//       // domain: '.ngrok.app', // important
//     });

//     return res.redirect(`${FRONTEND_BASE_URL}/auth/callback?code=${code}`);
//   } catch (error: any) {
//     console.error('❌ GitHub callback failed:', error);
//     return res
//       .status(500)
//       .json({ error: 'Server Error', message: error.message });
//   }
// };

// export const handleGitHubCallback = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   const code = req.query.code as string;
//   if (!code) {
//     res.status(400).send('Missing code');
//     return;
//   }

//   try {
//     const githubToken = await exchangeCodeForToken(code);
//     res.cookie('github_access_token', githubToken, {
//       httpOnly: true,
//       secure: true,
//       sameSite: 'none',
//       domain: 'devai-three.vercel.app',
//     });

//     res.redirect(`${FRONTEND_BASE_URL}/orgselector`);
//   } catch (err: any) {
//     console.error('GitHub callback failed:', err.message);
//     res.status(500).json({ error: 'Token exchange failed' });
//   }
// };

export const handleGitHubCallback = async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) {
    res.status(400).send('Missing code');
    return;
  }

  // ✅ Do NOT use exchangeCodeForToken here — just pass the code to frontend
  res.redirect(`${FRONTEND_BASE_URL}/auth/callback?code=${code}`);
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
    const code = req.body.code as string;
    if (!code) {
      console.error('❌ completeAuth: Missing authorization code');
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    console.log('🔐 completeAuth: Exchanging code for token...');

    // ✅ Only here: exchange the code
    let githubToken: string;
    try {
      githubToken = await exchangeCodeForToken(code);
      console.log('✅ Token exchange successful');
    } catch (tokenError: any) {
      console.error('❌ Token exchange failed:', tokenError.message);

      // Check if code expired
      if (
        tokenError.message?.includes('expired') ||
        tokenError.message?.includes('invalid')
      ) {
        return res.status(400).json({
          error:
            'Authorization code expired or invalid. Please try logging in again.',
        });
      }

      // Re-throw other errors
      throw tokenError;
    }

    res.cookie('github_access_token', githubToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/', // Safari requires explicit path
      // Remove domain setting - let browser handle it for better Safari compatibility
    });

    const githubData = await getGitHubUserProfile(githubToken);
    const user = await findOrCreateUser(githubData, githubToken);

    const token = generateUserJWTToken({
      _id: user._id!.toString(),
      username: user.username,
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/', // Safari requires explicit path
    });

    const installations = await getAppInstallations(githubToken);
    const { isInstalled, installationId } = checkIfAppInstalled(installations);

    if (installationId) {
      res.cookie('installation_id', installationId, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/', // Safari requires explicit path
      });
    }

    const responseData = {
      token,
      githubToken,
      installed: isInstalled,
      installationId,
      needsInstall: !isInstalled,
    };

    console.log('✅ completeAuth: Sending response with tokens:', {
      hasToken: !!token,
      hasGithubToken: !!githubToken,
      tokenLength: token?.length || 0,
      githubTokenLength: githubToken?.length || 0,
      installed: isInstalled,
    });

    res.status(200).json(responseData);
  } catch (err: any) {
    console.error('❌ Error in completeAuth:', err);
    handleApiError(err, res, 'Authentication completion failed');
  }
};
// Add this to your auth.controller.ts

export const getGitHubUserOrgs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Debug: Log all headers to see what we're receiving
    console.log('🔍 getGitHubUserOrgs - Request headers:', {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      authorizationValue: req.headers.authorization?.substring(0, 30) || 'none',
      cookie: req.headers.cookie ? 'Present' : 'Missing',
      origin: req.headers.origin,
    });

    // Try to get token from Authorization header first (for Safari compatibility)
    // Fallback to cookie if header not present
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies.github_access_token;

    console.log('🔍 Token sources:', {
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 20) || 'none',
      hasCookieToken: !!cookieToken,
      cookieTokenPrefix: cookieToken?.substring(0, 10) || 'none',
    });

    let githubToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : cookieToken;

    if (!githubToken) {
      console.error(
        '❌ getGitHubUserOrgs: No GitHub token found in header or cookies',
        {
          authHeader: authHeader ? 'present but invalid format' : 'missing',
          cookieToken: cookieToken ? 'present' : 'missing',
        }
      );
      res.status(401).json({ error: 'Missing GitHub token' });
      return;
    }

    console.log(
      '🔐 Using GitHub token from:',
      authHeader ? 'Authorization header' : 'cookie',
      {
        tokenLength: githubToken.length,
        tokenPrefix: githubToken.substring(0, 10),
      }
    );

    console.log('🔐 Using GitHub token:', githubToken.slice(0, 6), '...');

    const headers = {
      Authorization: `Bearer ${githubToken}`,
      'User-Agent': 'devAI-app',
      Accept: 'application/vnd.github+json',
    };

    // Fetch user's personal account info
    const userResponse = await fetch('https://api.github.com/user', {
      headers,
    });

    if (userResponse.status === 401) {
      console.warn('⚠️ GitHub token is invalid or expired — clearing cookie');
      res.clearCookie('github_access_token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/', // Must match the path used when setting the cookie
      });
      res.status(401).json({
        error: 'GitHub token expired or invalid — please reauthenticate',
      });
      return;
    }

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('❌ GitHub user fetch failed:', errorText);
      res.status(500).json({ error: 'Failed to fetch GitHub user' });
      return;
    }

    const user = await userResponse.json();

    // Fetch orgs from GitHub API
    const orgsResponse = await fetch('https://api.github.com/user/orgs', {
      headers,
    });

    if (!orgsResponse.ok) {
      const errorText = await orgsResponse.text();
      console.error('❌ GitHub orgs fetch failed:', errorText);
      res.status(500).json({ error: 'Failed to fetch GitHub orgs' });
      return;
    }

    const orgs = (await orgsResponse.json()) as {
      id: number;
      login: string;
      avatar_url: string;
    }[];

    // Check if user has personal installation of the app
    const installations = await getAppInstallations(githubToken);
    const installationsList = Array.isArray(installations)
      ? installations
      : installations.installations || [];

    // Find personal installation (where account.login matches user.login)
    const personalInstallation = installationsList.find(
      (inst: any) => inst.account && inst.account.login === user.login
    );

    // Build result: include personal account first, then orgs
    const result = [];

    // Add personal account if app is installed on it
    if (personalInstallation) {
      result.push({
        id: user.id,
        login: user.login,
        avatar_url: user.avatar_url,
        isPersonal: true, // Flag to identify personal account
      });
    }

    // Add organizations
    result.push(
      ...orgs.map(({ id, login, avatar_url }) => ({
        id,
        login,
        avatar_url,
        isPersonal: false,
      }))
    );

    res.json(result);
  } catch (err: any) {
    console.error('🔥 Error in getGitHubUserOrgs:', err.message);
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

    // Read org/login from query - can be organization or personal account
    const org = req.query.org as string | undefined;
    // Try to get installation_id from cookie, fallback to header if needed
    let installationId = req.cookies.installation_id;

    if (org) {
      // Try to get token from Authorization header first (for Safari compatibility)
      // Fallback to cookie if header not present
      const authHeader = req.headers.authorization;
      const githubToken = authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : req.cookies.github_access_token;

      if (!githubToken) {
        console.error(
          '❌ listRepos: No GitHub token found in header or cookies'
        );
        res.status(401).json({ error: 'Missing GitHub token' });
        return;
      }

      console.log(
        '🔐 listRepos: Using GitHub token from:',
        authHeader ? 'Authorization header' : 'cookie'
      );
      const installationsResult = await getAppInstallations(githubToken);
      console.log('installationsResult:', installationsResult);
      const installations = Array.isArray(installationsResult)
        ? installationsResult
        : installationsResult.installations || [];

      if (!installations || installations.length === 0) {
        res.status(404).json({ error: 'No installations found for this user' });
        return;
      }
      // Find installation matching the selected org/login (works for both orgs and personal accounts)
      const match = installations.find(
        (inst: any) =>
          inst.account &&
          inst.account.login &&
          inst.account.login.toLowerCase() === org.toLowerCase()
      );
      if (!match) {
        res
          .status(404)
          .json({ error: 'App not installed on this account or organization' });
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
