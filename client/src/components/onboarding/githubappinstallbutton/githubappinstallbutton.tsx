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
      style={{
        fontSize: 18,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        background: '#22272E',
        color: '#fff',
        border: 'none',
        padding: '0.6rem 1.2rem',
        borderRadius: '8px',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        transition: 'background 0.2s',
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = '#2f3541')}
      onMouseOut={(e) => (e.currentTarget.style.background = '#22272E')}
    >
      <FontAwesomeIcon icon={faGithub} />
      Install GitHub App
    </button>
  );
};

export default GitHubAppInstallButton;
