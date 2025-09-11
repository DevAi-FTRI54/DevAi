import { createAppAuth } from '@octokit/auth-app';

export const authApp = createAppAuth({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_PRIVATE_KEY!,
  clientId: process.env.GITHUB_APP_CLIENT_ID!,
  clientSecret: process.env.GITHUB_APP_CLIENT_SECRET!,
  // clientId: process.env.GITHUB_CLIENT_ID!,
  // clientSecret: process.env.GITHUB_CLIENT_SECRET!,
});

export async function getInstallationToken(installationId: number) {
  const auth = authApp;
  const { token } = await auth({
    type: 'installation',
    installationId,
  });
  return token;
}
