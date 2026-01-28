// GitHub App installation management
import { GitHubApiError } from '../utils/error.utils.js';
import {
  GITHUB_APP_ID,
  GITHUB_APP_SLUG,
  REDIRECT_AFTER_INSTALL,
  FRONTEND_BASE_URL,
} from '../../../config/env.validation.js';

const APP_SLUG = GITHUB_APP_SLUG;
const APP_ID = Number(GITHUB_APP_ID);
const redirectAfterInstall =
  REDIRECT_AFTER_INSTALL || `${FRONTEND_BASE_URL}/select-repo`;

// GitHub installation response interface
interface GithubInstallation {
  id: string;
  app_id: number;
  app_slug?: string;
  [key: string]: any;
}

interface InstallationsResponse {
  installations?: GithubInstallation[];
  [key: string]: any;
}

// Get GitHub app installations for user
export async function getAppInstallations(accessToken: string): Promise<any> {
  const response = await fetch('https://api.github.com/user/installations', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new GitHubApiError(
      'Failed to fetch app installations',
      response.status,
      data,
    );
  }

  return data;
}

// Check if GitHub App is installed
export function checkIfAppInstalled(installations: InstallationsResponse): {
  isInstalled: boolean;
  installationId?: string;
} {
  if (!installations?.installations?.length) {
    return { isInstalled: false };
  }

  const appInstallation = installations.installations.find(
    (inst) => inst.app_id === APP_ID || inst.app_slug === APP_SLUG,
  );

  return {
    isInstalled: !!appInstallation,
    installationId: appInstallation?.id,
  };
}

// Get GitHub App installation URL
export function getAppInstallationUrl(): string {
  // return `https://github.com/apps/${APP_SLUG}/installations/new?redirect_url=${encodeURIComponent(
  //   redirectAfterInstall
  // )}`;
  // ✅ Always force new installation flow, don't go to settings
  return `https://github.com/apps/${APP_SLUG}/installations/new?state=force_new`;
}
