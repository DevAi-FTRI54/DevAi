// config/github.config.ts
import {
  GITHUB_APP_CLIENT_ID,
  GITHUB_APP_CLIENT_SECRET,
  GITHUB_APP_ID,
  GITHUB_APP_SLUG,
  GITHUB_APP_PRIVATE_KEY,
  GITHUB_REDIRECT_URI,
} from './env.validation.js';

export default {
  clientId: GITHUB_APP_CLIENT_ID,
  clientSecret: GITHUB_APP_CLIENT_SECRET,
  appId: GITHUB_APP_ID,
  appSlug: GITHUB_APP_SLUG,
  privateKey: GITHUB_APP_PRIVATE_KEY,
  redirectUri: GITHUB_REDIRECT_URI,
  apiVersion: '2022-11-28',
};
