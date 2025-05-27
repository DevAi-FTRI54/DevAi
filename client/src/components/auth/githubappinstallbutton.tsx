import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';

const GitHubAppInstallButton: React.FC = () => {
  const handleInstall = () => {
    window.location.href = `https://github.com/apps/devai-repo-agent/installations/new`;
  };

  return (
    <button
      onClick={handleInstall}
      className="
        flex items-center gap-2 
        bg-[#22272E] text-white 
        px-5 py-2 rounded-lg 
        cursor-pointer shadow-md 
        transition-colors 
        font-tt-hoves text-[18px] 
        hover:bg-[#2f3541]
      "
    >
      <FontAwesomeIcon icon={faGithub} />
      Install GitHub App
    </button>
  );
};

export default GitHubAppInstallButton;
