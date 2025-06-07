// Contains controller functions for handling auth route requests and responses.
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import User from '../../../models/user.model.js';
import mongoose from 'mongoose';
import { exchangeCodeForToken, getGitHubUserProfile, getRepositoriesWithMeta } from '../services/github.service.js';
import { getAppInstallationUrl, checkIfAppInstalled, getAppInstallations } from '../services/installation.service.js';
import { findOrCreateUser } from '../services/user.service.js';
import { generateUserJWTToken } from '../services/jwt.service.js';
import { handleApiError } from '../utils/error.utils.js';
import 'dotenv/config';

console.log('Loading auth.controller.ts');

//Github OAuth credentials for the app NOT FOR THE USER!!!!
//Github code and access token are for users and are dynamic (Different Thing)
const GITHUB_APP_CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID!;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';

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
  const githubAuthURL = `https://github.com/login/oauth/authorize?client_id=${GITHUB_APP_CLIENT_ID}`;
  res.redirect(githubAuthURL);
};

// Process Github callback with auth code
export const handleGitHubCallback = async (req: Request, res: Response): Promise<any> => {
  try {
    const code = req.query.code as string;
    if (!code) return res.status(400).send('Missing code');

    const access_token = await exchangeCodeForToken(code);

    // Store github access token in cookies
    res.cookie('github_access_token', access_token, {
      httpOnly: true,
      secure: false, // ⛔ Set to true in production over HTTPS
      sameSite: 'lax', // 'lax' allows GET redirects to carry cookies
    });

    // return res.redirect(`https://0926-47-14-82-7.ngrok-free.app/api/auth/complete`);
    return res.redirect(`${FRONTEND_BASE_URL}/api/auth/complete`);
  } catch (error) {
    handleApiError(error, res, 'GitHub callback failed');
  }
};

// 2. Get GitHub response
export const completeAuth = async (req: Request, res: Response): Promise<any> => {
  try {
    const githubToken = req.cookies.github_access_token;
    if (!githubToken) return res.status(401).send('Missing GitHub token');

    const githubData = await getGitHubUserProfile(githubToken);
    const user = await findOrCreateUser(githubData, githubToken);

    const token = generateUserJWTToken({
      _id: user._id!.toString(),
      username: user.username,
    });
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // 'dev' only
      sameSite: 'lax',
    });

    // Check app installation status
    console.log('--- user accessToken ---------');
    console.log(user.accessToken);

    const installations = await getAppInstallations(githubToken);
    const { isInstalled, installationId } = checkIfAppInstalled(installations);

    // Store the installation id for front-end to access the repos
    if (installationId) {
      res.cookie('installation_id', installationId, {
        httpOnly: true,
        sameSite: 'none', // <- must be 'none' for cross-origin cookies!
        secure: true, // <- required for 'none'
        domain: '.ngrok.app', // (optional, can be omitted, usually works w/o)
      });
    }

    if (isInstalled) {
      console.log('✅ GitHub App is installed');
      res.redirect(`${FRONTEND_BASE_URL}/select-repo`);
    } else {
      const installUrl = getAppInstallationUrl();
      console.log('🔁 Redirecting to install GitHub App:', installUrl);
      return res.redirect(installUrl);
    }
  } catch (err) {
    handleApiError(err, res, 'Authentication completion failed');
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
        retryAfter: Math.ceil((CIRCUIT_RESET_TIME - (now - lastFailureTime)) / 1000),
      });
      return;
    }
  }

  try {
    if (!mongoose.connection.readyState) {
      res.status(503).json({ error: 'Database not ready' });
      return;
    }

    const installationId = req.cookies.installation_id;
    if (!installationId) {
      res.status(400).send('No installation_id');
      return;
    }

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
export const getGithubToken = async (req: Request, res: Response): Promise<void> => {
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
