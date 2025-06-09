// config/github.config.ts
export default {
    clientId: process.env.GITHUB_APP_CLIENT_ID,
    clientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
    appId: process.env.GITHUB_APP_ID,
    appSlug: process.env.GITHUB_APP_SLUG.toLowerCase(),
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
    redirectUri: process.env.REDIRECT_URI || 'http://localhost:5173/select-repo',
    apiVersion: '2022-11-28',
};
