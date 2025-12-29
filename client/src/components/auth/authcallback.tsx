import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiBaseUrl } from '../../utils/api';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const completeAuth = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        console.log('🔍 Auth callback - Code received:', code ? 'Yes' : 'No');

        if (!code) {
          setError('No authorization code received from GitHub');
          setIsLoading(false);
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        console.log('🚀 Sending code to backend for token exchange...');

        // Use API base URL (works in both dev and production)
        const res = await fetch(`${apiBaseUrl}/auth/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
          credentials: 'include', // Required for Safari to send cookies
        });

        console.log('📡 Response status:', res.status, res.statusText);

        if (!res.ok) {
          const errorText = await res.text();
          console.error('❌ Auth failed:', res.status, errorText);

          // Check for specific error messages
          if (errorText.includes('expired') || res.status === 401) {
            setError(
              'Authorization code expired. Please try logging in again.'
            );
          } else if (res.status === 400) {
            setError(
              'Invalid authorization code. Please try logging in again.'
            );
          } else {
            setError(
              `Authentication failed (${res.status}). Please try again.`
            );
          }

          setIsLoading(false);
          setTimeout(() => navigate('/login'), 5000);
          return;
        }

        const data = await res.json();
        console.log('✅ Auth successful, received data:', {
          hasToken: !!data.token,
          hasGithubToken: !!data.githubToken,
          installed: data.installed,
          needsInstall: data.needsInstall,
        });

        // Store tokens in localStorage
        if (data.token) {
          localStorage.setItem('jwt', data.token);
          console.log('✅ JWT token stored in localStorage');
        } else {
          console.warn('⚠️ No JWT token in response');
        }

        if (data.githubToken) {
          localStorage.setItem('githubToken', data.githubToken);
          console.log('✅ GitHub token stored in localStorage');

          // Verify it was stored (Safari sometimes has issues with localStorage)
          const stored = localStorage.getItem('githubToken');
          if (stored === data.githubToken) {
            console.log('✅ Verified: GitHub token is in localStorage');
          } else {
            console.error(
              '❌ WARNING: Token was not stored correctly in localStorage!'
            );
          }
        } else {
          console.error('❌ No GitHub token in response!');
          setError('Authentication failed: No token received from server');
          setIsLoading(false);
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        // Check cookies were set (Safari might not set them)
        console.log(
          '🍪 Cookies may not be available in Safari, using localStorage tokens'
        );

        // Small delay to ensure localStorage is written before navigation
        // This helps with Safari's sometimes-slow localStorage writes
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Navigate based on installation status
        if (data.installed === false || data.needsInstall === true) {
          console.log('📦 App not installed, redirecting to install page');
          navigate('/install-github-app');
        } else {
          console.log('✅ App installed, redirecting to org selector');
          navigate('/orgselector');
        }
      } catch (err) {
        // Network errors, CORS errors, etc.
        console.error('❌ Network or fetch error:', err);
        setError(
          err instanceof Error
            ? `Connection error: ${err.message}`
            : 'Failed to connect to server. Please check your connection and try again.'
        );
        setIsLoading(false);
        setTimeout(() => navigate('/login'), 5000);
      }
    };

    completeAuth();
  }, [navigate]);

  return (
    <div className='flex items-center justify-center min-h-screen bg-black'>
      <div className='font-tt-hoves p-4 text-white text-center'>
        {isLoading && !error && <div>Authenticating with GitHub...</div>}
        {error && (
          <div className='text-red-400'>
            <div className='mb-2'>❌ {error}</div>
            <div className='text-sm text-gray-400'>Redirecting to login...</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
