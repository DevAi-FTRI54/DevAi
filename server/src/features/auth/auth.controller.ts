// Contains controller functions for handling auth route requests and responses.
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import User from '../../models/user.model.js';

//Github OAuth credentials for the app NOT FOR THE USER!!!!
//Github code and access token are for users and are dynamic (Different Thing)
const CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const JWT_SECRET = process.env.JWT_SECRET!;
const REDIRECT_URI = 'ngrok';
//redirected to this route after the successful github login
//In your GitHub OAuth app settings, you must set the Authorization callback URL to match your REDIRECT_URI.
//https://github.com/settings/developers

export const getGitHubLoginURL = (req: Request, res: Response) => {
  const githubAuthURL = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=read:user user:email`;
  res.redirect(githubAuthURL);
};

export const handleGitHubCallback = async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send('Missing code');

  const tokenResponse = await fetch(`https://github.com/login/oauth/access_token`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      client_secret: process.env.GITHUB_CLIENT_SECRET!,
      code,
    }),
  });

  const { access_token } = await tokenResponse.json();
  if (!access_token) return res.status(401).send('Access token error');

  // 2. Get GitHub user info
  const userResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const githubData = await userResponse.json();

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

  // 4. Sign JWT
  const token = jwt.sign({ userId: user._id, githubUsername: user.username }, JWT_SECRET, { expiresIn: '2h' });

  // 5. Return or set cookie
  res.cookie('token', token, { httpOnly: true, secure: false }); // Set secure=true in prod
  res.redirect('http://localhost:3000/dashboard'); // Or wherever your frontend lives
};
