import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';

const GitHubLogin: React.FC = () => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for error in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, []);

  const handleLogin = () => {
    window.location.href = 'http://localhost:4000/api/auth/github';
  };

  return (
    <div className='min-h-screen bg-[#171717] flex flex-col items-center justify-center'>
      <div className='bg-[#212121] border border-[#303030] rounded-2xl shadow-lg p-8 max-w-md mx-auto text-center'>
        <div className='w-16 h-16 bg-gradient-to-br from-[#5ea9ea] to-[#4a9ae0] rounded-2xl flex items-center justify-center mx-auto mb-6'>
          <FontAwesomeIcon icon={faGithub} className='text-white text-2xl' />
        </div>

        <h1 className='text-xl font-semibold text-[#fafafa] mb-2'>
          Welcome to DevAI
        </h1>
        <p className='text-[#888] text-sm mb-6'>
          Connect your GitHub account to get started with AI-powered code
          analysis
        </p>

        {error && (
          <div className='mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg'>
            <p className='text-red-400 text-sm'>{error}</p>
          </div>
        )}

        <button
          onClick={handleLogin}
          className='w-full flex items-center justify-center gap-3 bg-[#5ea9ea] hover:bg-[#4a9ae0] text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl'
        >
          <FontAwesomeIcon icon={faGithub} />
          Login with GitHub
        </button>
      </div>
    </div>
  );
};

export default GitHubLogin;
