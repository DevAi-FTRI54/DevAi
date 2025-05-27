// Contains controller functions for handling auth route requests and responses.
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import User from '../../models/user.model.js';
import mongoose from 'mongoose';

console.log('Loading auth.controller.ts');

//Github OAuth credentials for the app NOT FOR THE USER!!!!
//Github code and access token are for users and are dynamic (Different Thing)
const CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
if (!CLIENT_ID) throw new Error('Missing GITHUB_CLIENT_ID env var');
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
if (!CLIENT_SECRET) throw new Error('Missing GITHUB_CLIENT_SECRET env var');
const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error('Missing JWT_SECRET env var');
const REDIRECT_URI = 'https://4276-47-14-82-7.ngrok-free.app/api/auth/callback';
//redirected to this route after the successful github login
//In your GitHub OAuth app settings, you must set the Authorization callback URL to match your REDIRECT_URI.
//https://github.com/settings/developers

// if (!CLIENT_ID || !CLIENT_SECRET || !JWT_SECRET) {
//   throw new Error('Missing required environment variables for GitHub OAuth or JWT');
// }

export const getGitHubLoginURL = (req: Request, res: Response) => {
  const githubAuthURL = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&scope=read:user user:email`;
  res.redirect(githubAuthURL);
};

export const handleGitHubCallback = async (req: Request, res: Response): Promise<any> => {
  console.log('--- req.query ------------');
  console.log(req.query);
  const code = req.query.code as string;
  if (!code) return res.status(400).send('Missing code');

  const tokenResponse = await fetch(`https://github.com/login/oauth/access_token`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
    }),
  });
  console.log('--- tokenResponse ------------');
  console.log(tokenResponse);

  const { access_token } = await tokenResponse.json();
  if (!access_token) return res.status(401).send('Access token error');

  res.cookie('github_access_token', access_token, { httpOnly: true });
  return res.redirect('http://localhost:4000/api/auth/complete'); // This will trigger completeAuth controller
  // res.redirect('http://localhost:3000/authcallback'); //*potentially not necessary
};

// 2. Get GitHub response
export const completeAuth = async (req: Request, res: Response): Promise<any> => {
  const githubToken = req.cookies.github_access_token;
  console.log('--- githubToken ------------');
  console.log(githubToken);
  if (!githubToken) return res.status(401).send('Missing GitHub token');

  const userResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${githubToken}` },
  });
  const githubData = await userResponse.json();
  console.log('--- githubData ------------');
  console.log(githubData);

  if (!githubData.login) return res.status(400).send('GitHub login failed');

  // 3. Create or find user
  let user = await User.findOne({ githubUsername: githubData.login });
  if (!user) {
    user = new User({
      githubUsername: githubData.login,
      email: githubData.email || `${githubData.login}@github.com`,
    });
    await user.save();
  }

  //4. Sign JWT
  const token = jwt.sign({ userId: user._id, githubUsername: user.username }, JWT_SECRET, { expiresIn: '2h' });

  // 5. Return or set cookie
  res.cookie('token', token, { httpOnly: true, secure: false }); // Set secure=true in prod
  return res.redirect('http://localhost:3000/githubapp'); // Or wherever your frontend lives
};
