import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';

const GitHubAppInstallButton: React.FC = () => {
  const REDIRECT_URL = import.meta.env.VITE_POST_INSTALL_REDIRECT || 'http://localhost:5173/select-repo';

  const handleInstall = () => {
    window.location.href = `https://github.com/apps/devairepoagent/installations/new?redirect_url=${encodeURIComponent(
      REDIRECT_URL
    )}`;
  };

  return (
    <button
      onClick={handleInstall}
      className="w-full flex items-center justify-center gap-3 bg-[#5ea9ea] hover:bg-[#4a9ae0] text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
    >
      <FontAwesomeIcon icon={faGithub} />
      Install GitHub App
    </button>
  );
};

export default GitHubAppInstallButton;
