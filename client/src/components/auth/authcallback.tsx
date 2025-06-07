import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const completeAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');

      if (!code) return;

      const res = await fetch('http://localhost:4000/api/auth/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) localStorage.setItem('jwt', data.token);
        if (data.githubToken) localStorage.setItem('githubToken', data.githubToken);

        if (data.installed === false || data.needsInstall === true) {
          navigate('/install-github-app');
        } else {
          navigate('/orgselector');
        }
      }
    };

    completeAuth();
  }, [navigate]);

  return <div className="font-tt-hoves p-4">Authenticating with GitHub...</div>;
};

export default AuthCallback;
