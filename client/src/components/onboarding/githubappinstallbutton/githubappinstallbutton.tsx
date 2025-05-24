import React from 'react';

// const GITHUB_APP_CLIENT_ID = 'YOUR_GITHUB_APP_CLIENT_ID'; // Not always used in install link
// const GITHUB_APP_SLUG = 'devai-repo-agent'; // from GitHub App settings

const GitHubAppInstallButton: React.FC = () => {
  const handleInstall = () => {
    // This is the GitHub install link for your app
    window.location.href = `https://github.com/apps/devai-repo-agent/installations/new`;
  };

  return (
    <button onClick={handleInstall} style={{ fontSize: 18 }}>
      🚀 Install GitHub App
    </button>
  );
};

export default GitHubAppInstallButton;
