import { createAppAuth } from '@octokit/auth-app';
import {
  GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY,
  GITHUB_APP_CLIENT_ID,
  GITHUB_APP_CLIENT_SECRET,
} from '../../config/env.validation.js';

export const authApp = createAppAuth({
  appId: GITHUB_APP_ID,
  privateKey: GITHUB_APP_PRIVATE_KEY,
  clientId: GITHUB_APP_CLIENT_ID,
  clientSecret: GITHUB_APP_CLIENT_SECRET,
});

export async function getInstallationToken(installationId: number) {
  const auth = authApp;
  const { token } = await auth({
    type: 'installation',
    installationId,
  });
  return token;
}
