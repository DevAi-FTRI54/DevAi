import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';

const GitHubLogin: React.FC = () => {
  const handleLogin = () => {
    window.location.href = 'http://localhost:4000/api/auth/github';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#23262f]">
      <h1 className="text-2xl text-white mb-6 font-tt-hoves font-normal leading-none tracking-tight text-center">
        Get started with DevAi
      </h1>
      <button
        onClick={handleLogin}
        className="px-8 py-3 text-base bg-[#5ea9ea] hover:bg-[#31677a] text-white rounded-lg shadow-md flex items-center gap-2 transition-colors font-tt-hoves"
      >
        <FontAwesomeIcon icon={faGithub} />
        Login with GitHub
      </button>
    </div>
  );
};

export default GitHubLogin;
