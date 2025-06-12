import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthCallback: React.FC = () => {
  console.log(
    '🔄 AuthCallback component mounted at:',
    new Date().toISOString()
  );

  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔄 AuthCallback effect running at:', new Date().toISOString());
    // Check if there's an error in the URL params
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    // If no error, the backend should have already redirected us
    // This component should only show briefly or in case of error
    const timer = setTimeout(() => {
      console.log('AuthCallback timeout - redirecting to login');
      navigate('/login');
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className='min-h-screen bg-[#171717] flex items-center justify-center'>
      <div className='bg-[#212121] border border-[#303030] rounded-2xl shadow-lg p-8 max-w-md mx-auto text-center'>
        <div className='w-12 h-12 bg-gradient-to-br from-[#5ea9ea] to-[#4a9ae0] rounded-xl flex items-center justify-center mx-auto mb-4'>
          {error ? (
            <svg
              className='w-6 h-6 text-white'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z'
                clipRule='evenodd'
              />
            </svg>
          ) : (
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
          )}
        </div>
        <h2 className='text-lg font-semibold text-[#fafafa] mb-2'>
          {error ? 'Authentication Error' : 'Completing Authentication'}
        </h2>
        <p className='text-[#888] text-sm'>
          {error
            ? error
            : 'Please wait while we complete your authentication...'}
        </p>
        {error && (
          <p className='text-xs text-[#666] mt-2'>
            Redirecting to login page in a few seconds...
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
