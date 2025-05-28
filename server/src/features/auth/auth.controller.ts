// Contains controller functions for handling auth route requests and responses.
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import User from '../../models/user.model.js';
import mongoose from 'mongoose';

console.log('Loading auth.controller.ts');

//Github OAuth credentials for the app NOT FOR THE USER!!!!
//Github code and access token are for users and are dynamic (Different Thing)
// const CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
// if (!CLIENT_ID) throw new Error('Missing GITHUB_CLIENT_ID env var');
// const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
// if (!CLIENT_SECRET) throw new Error('Missing GITHUB_CLIENT_SECRET env var');
const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error('Missing JWT_SECRET env var');

const REDIRECT_URI =
  'https://9f6f-185-185-128-204.ngrok-free.app/api/auth/callback';

const REDIRECT_URI = 'https://7ed8-185-185-128-204.ngrok-free.app/api/auth/callback';


const GITHUB_APP_CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID!;
const GITHUB_APP_CLIENT_SECRET = process.env.GITHUB_APP_CLIENT_SECRET!;

//redirected to this route after the successful github login
//In your GitHub OAuth app settings, you must set the Authorization callback URL to match your REDIRECT_URI.
//https://github.com/settings/developers

// if (!CLIENT_ID || !CLIENT_SECRET || !JWT_SECRET) {
//   throw new Error('Missing required environment variables for GitHub OAuth or JWT');
// }

export const getGitHubLoginURL = (req: Request, res: Response) => {
  // const githubAuthURL = `https://github.com/login/oauth/authorize?client_id=${GITHUB_APP_CLIENT_ID}&redirect_uri=${encodeURIComponent(
  //   REDIRECT_URI
  // )}&scope=read:user user:email`;
  // res.redirect(githubAuthURL);
  console.log('Using client_id:', GITHUB_APP_CLIENT_ID);
  const githubAuthURL = `https://github.com/login/oauth/authorize?client_id=${GITHUB_APP_CLIENT_ID}`;
  res.redirect(githubAuthURL);
};

export const handleGitHubCallback = async (req: Request, res: Response): Promise<any> => {
  console.log('--- req.query ------------');
  console.log(req.query);
  const code = req.query.code as string;
  if (!code) return res.status(400).send('Missing code');


  const tokenResponse = await fetch(
    `https://github.com/login/oauth/access_token`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GITHUB_APP_CLIENT_ID,
        client_secret: GITHUB_APP_CLIENT_SECRET,
        code,
      }),
    }
  );

  const tokenResponse = await fetch(`https://github.com/login/oauth/access_token`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GITHUB_APP_CLIENT_ID,
      client_secret: GITHUB_APP_CLIENT_SECRET,
      code,
    }),
  });

  // console.log('--- tokenResponse ------------');
  // console.log(tokenResponse);

  // const body = await tokenResponse.json();
  // console.log('--- body ------------');
  // console.log(body);

  const { access_token } = await tokenResponse.json();
  console.log('--- access_token ---------');
  console.log(access_token);
  if (!access_token) return res.status(401).send('Access token error');

  // changing cookie settings

  res.cookie('github_access_token', access_token, { httpOnly: true });

  res.cookie('github_access_token', access_token, {
    httpOnly: true,
    secure: false, // ⛔ Set to true in production over HTTPS
    sameSite: 'lax', // 'lax' allows GET redirects to carry cookies
  });


  return res.redirect(
    'https://9f6f-185-185-128-204.ngrok-free.app/api/auth/complete'
  ); // This will trigger completeAuth controller

  return res.redirect('https://7ed8-185-185-128-204.ngrok-free.app/api/auth/complete'); // This will trigger completeAuth controller

  // return res.redirect('http://localhost:4000/api/auth/complete'); // This will trigger completeAuth controller
  // res.redirect('http://localhost:3000/authcallback'); //*potentially not necessary
};

// 2. Get GitHub response

export const completeAuth = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const githubToken = req.cookies.github_access_token;
    // console.log('--- githubToken ---------');
    // console.log(githubToken);
    if (!githubToken) return res.status(401).send('Missing GitHub token');

    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${githubToken}` },
    });
    const githubData = await userResponse.json();
    // console.log('--- githubData ------------');
    // console.log(githubData);

// export const completeAuth = async (req: Request, res: Response): Promise<any> => {
//   const githubToken = req.cookies.github_access_token;
//   if (!githubToken) return res.status(401).send('Missing GitHub token');
//   console.log('--- githubToken ---------');
//   console.log(githubToken);

//   const userResponse = await fetch('https://api.github.com/user', {
//     headers: { Authorization: `Bearer ${githubToken}` },
//   });
//   const githubData = await userResponse.json();
//   // console.log('--- githubData ------------');
//   // console.log(githubData);

//   if (!githubData.login) return res.status(400).send('GitHub login failed');

//   let user = await User.findOne({ githubUsername: githubData.login });
//   if (!user) {
//     user = new User({
//       githubId: githubData.id.toString(), // required and unique
//       username: githubData.login,
//       avatarUrl: githubData.avatar_url,
//       email: githubData.email || `${githubData.login}@users.noreply.github.com`,
//       accessToken: githubToken, // optional but handy
//     });
//     await user.save();
//   }
//   console.log('--- user ---------');
//   console.log(user);

//   // 🔐 JWT for your app
//   const token = jwt.sign({ userId: user._id, githubUsername: user.username }, JWT_SECRET, { expiresIn: '2h' });
//   console.log('--- token ---------');
//   console.log(token);
//   res.cookie('token', token, { httpOnly: true, secure: false });

//   const installURL = `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`;
//   return res.redirect(installURL);

// // 🔍 Check if GitHub App is installed
// const appCheckRes = await fetch('https://api.github.com/user/installations', {
//   headers: {
//     Authorization: `Bearer ${githubToken}`,
//     Accept: 'application/vnd.github+json',
//   },
// });

// const installations = await appCheckRes.json();
// console.log('--- installations ---------');
// console.log(installations);
// const isAppInstalled = installations?.installations?.some(
//   (inst: any) => inst.app_slug === process.env.GITHUB_APP_SLUG
// );

// if (isAppInstalled) {
//   return res.redirect('http://localhost:3000/select-repo');
// } else {
//   const installURL = `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`;
//   return res.redirect(installURL);
// }
// };

export const completeAuth = async (req: Request, res: Response): Promise<any> => {
  try {
    const githubToken = req.cookies.github_access_token;
    console.log('--- githubToken ---------');
    console.log(githubToken);
    if (!githubToken) return res.status(401).send('Missing GitHub token');

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        'ngrok-skip-browser-warning': '1',
        'User-Agent': 'my-custom-user-agent/1.0',
      },
    });
    const githubData = await userResponse.json();
    console.log('--- githubData ------------');
    console.log(githubData);


    if (!githubData.login) return res.status(400).send('GitHub login failed');

    let user = await User.findOne({ githubId: githubData.id.toString() });
    if (!user) {
      user = new User({
        githubId: githubData.id.toString(),
        username: githubData.login,
        avatarUrl: githubData.avatar_url,

        email:
          githubData.email || `${githubData.login}@users.noreply.github.com`,

        email: githubData.email || `${githubData.login}@users.noreply.github.com`,

        accessToken: githubToken,
      });
      await user.save();
    }

    console.log('✅ User found or created:', user);


    const token = jwt.sign(
      { userId: user._id, githubUsername: user.username },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax', // must be "none" for cross-site XHR/fetch
    });

    // OPTIONAL: Check GitHub App installation
    const installRes = await fetch(
      'https://api.github.com/user/installations',
      {
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
          // Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );
    const installs = await installRes.json();
    // console.log('--- installs ---------');
    // console.log(installs);

    const APP_SLUG = process.env.GITHUB_APP_SLUG!.toLowerCase();
    const APP_ID = Number(process.env.GITHUB_APP_ID);

    const isInstalled = installs.installations?.some(
      (inst: any) => inst.app_id === APP_ID || inst.app_slug === APP_SLUG
    );
    const REDIRECT_AFTER_INSTALL = 'http://localhost:5173/select-repo';

    // Grab the installation id
    const installationId = installs.installations?.find(
      (i: any) => i.app_id === APP_ID || i.app_slug === APP_SLUG
    )?.id;

    // Store the installation id for front-end to access the repos
    res.cookie('installation_id', installationId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // dev only
    });

    if (isInstalled) {
      console.log('✅ GitHub App is installed');
      return res.redirect(
        'https://9f6f-185-185-128-204.ngrok-free.app/select-repo'
      );
    } else {
      const installUrl = `https://github.com/apps/${APP_SLUG}/installations/new?redirect_url=${encodeURIComponent(
        REDIRECT_AFTER_INSTALL
      )}`;
      console.log('🔁 Redirecting to install GitHub App:', installUrl);
      return res.redirect(installUrl);
      // const installUrl = `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`;
      // console.log('🔁 Redirecting to install GitHub App:', installUrl);
      // return res.redirect(installUrl);
    }
  } catch (err) {
    console.error('❌ Error in completeAuth:', err);
    res.status(500).send('Internal server error during GitHub auth flow.');
  }
};

// 3. List repos
export const listRepos = async (req: Request, res: Response): Promise<void> => {
  const installationId = req.cookies.installation_id;
  if (!installationId) {
    res.status(400).send('No installation_id');
    return;
  }

  console.log('--- installationId ---------');
  console.log(installationId);

  // 1. short lived JWT as the app
  const now = Math.floor(Date.now() / 1000);
  const jwtToken = jwt.sign(
    { iat: now - 60, exp: now + 600, iss: process.env.GITHUB_APP_ID },
    process.env.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    { algorithm: 'RS256' }
  );

  const tokenRes = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  console.log('--- tokenRes ---------');
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) {
    console.error('GitHub /access_tokens error', tokenRes.status, tokenJson);
    res.status(502).send(tokenJson); // bail early
    return;
  }

  const installationToken = tokenJson.token;

  const repoRes = await fetch(
    'https://api.github.com/installation/repositories',
    {
      headers: {
        Authorization: `token ${installationToken}`, // ghs_…
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  const repoJson = await repoRes.json();
  if (!repoRes.ok) {
    console.error(
      'GitHub /installation/repositories error',
      repoRes.status,
      repoJson
    );
    res.status(502).send(repoJson);
    return;

    const token = jwt.sign({ userId: user._id, githubUsername: user.username }, JWT_SECRET, { expiresIn: '2h' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    });

    // OPTIONAL: Check GitHub App installation
    const installRes = await fetch('https://api.github.com/user/installations', {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
        // Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    const installs = await installRes.json();
    console.log('--- installs ---------');
    console.log(installs);

    const APP_SLUG = process.env.GITHUB_APP_SLUG!.toLowerCase();
    const APP_ID = Number(process.env.GITHUB_APP_ID);

    const isInstalled = installs.installations?.some((inst: any) => {
      inst.app_id === APP_ID || inst.app_slug === APP_SLUG;
    });
    const REDIRECT_AFTER_INSTALL = 'http://localhost:3000/select-repo';

    if (isInstalled) {
      console.log('✅ GitHub App is installed');
      return res.redirect('http://localhost:3000/select-repo');
    } else {
      const installUrl = `https://github.com/apps/${APP_SLUG}/installations/new?redirect_url=${encodeURIComponent(
        REDIRECT_AFTER_INSTALL
      )}`;
      console.log('🔁 Redirecting to install GitHub App:', installUrl);
      return res.redirect(installUrl);
      // const installUrl = `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`;
      // console.log('🔁 Redirecting to install GitHub App:', installUrl);
      // return res.redirect(installUrl);
    }
  } catch (err) {
    console.error('❌ Error in completeAuth:', err);
    res.status(500).send('Internal server error during GitHub auth flow.');

  }
  const repositories = repoJson.repositories;
  console.log('--- repositories ---------');
  console.log(repositories);

  // res.json(
  //   repositories.map((r: any) => ({
  //     id: r.id,
  //     full_name: r.full_name,
  //     repoUrl: r.html_url,
  //     sha: head.sha,
  //   }))
  // );

  // after we have 'repositories' and 'installationToken'
  const repoMeta = await Promise.all(
    repositories.map(async (r: any) => {
      // fetch the latest commit on the default branch
      const headRes = await fetch(
        `https://api.github.com/repos/${r.full_name}/commits/${r.default_branch}`,
        {
          headers: {
            Authorization: `token ${installationToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      const head = await headRes.json(); // { sha: 'abc123...', ... }

      return {
        id: r.id,
        full_name: r.full_name,
        html_url: r.html_url,
        sha: head.sha,
      };
    })
  );

  res.json(repoMeta);
};
