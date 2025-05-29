import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';

const GitHubAppInstallButton: React.FC = () => {
  const handleInstall = () => {
    const redirectUrl = 'http://localhost:5173/select-repo'; // or your prod URL!
    window.location.href = `https://github.com/apps/devairepoagent/installations/new?redirect_url=${encodeURIComponent(
      redirectUrl
    )}`;
  };

  return (
    <button
      onClick={handleInstall}
      className="
        flex items-center gap-2 
        bg-[#5ea9ea] text-white 
        px-5 py-2 rounded-lg 
        cursor-pointer shadow-md 
        transition-colors 
        font-tt-hoves text-[18px] 
        hover:bg-[#31677a]
      "
    >
      <FontAwesomeIcon icon={faGithub} />
      Install GitHub App
    </button>
  );
};

export default GitHubAppInstallButton;
