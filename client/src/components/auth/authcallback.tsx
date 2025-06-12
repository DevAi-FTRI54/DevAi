import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const completeAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');

      if (!code) return;

      const res = await fetch(
        'https://a59d8fd60bb0.ngrok.app/api/auth/complete',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
          credentials: 'include',
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.token) localStorage.setItem('jwt', data.token);
        if (data.githubToken)
          localStorage.setItem('githubToken', data.githubToken);

        if (data.installed === false || data.needsInstall === true) {
          navigate('/install-github-app');
        } else {
          navigate('/orgselector');
        }
      }
    };

    completeAuth();
  }, [navigate]);

  return (
    <div className='min-h-screen bg-[#171717] flex items-center justify-center'>
      <div className='bg-[#212121] border border-[#303030] rounded-2xl shadow-lg p-8 max-w-md mx-auto text-center'>
        <div className='w-12 h-12 bg-gradient-to-br from-[#5ea9ea] to-[#4a9ae0] rounded-xl flex items-center justify-center mx-auto mb-4'>
          <svg
            className='w-6 h-6 text-white animate-spin'
            fill='currentColor'
            viewBox='0 0 20 20'
          >
            <path
              fillRule='evenodd'
              d='M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z'
              clipRule='evenodd'
            />
          </svg>
        </div>
        <h2 className='text-lg font-semibold text-[#fafafa] mb-2'>
          Authenticating with GitHub
        </h2>
        <p className='text-[#888] text-sm'>
          Please wait while we complete your authentication...
        </p>
      </div>
    </div>
  );
};

export default AuthCallback;
