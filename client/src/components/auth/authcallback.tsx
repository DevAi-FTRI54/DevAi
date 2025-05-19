import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    //* used to fetch user data or token confirmation
    const completeAuth = async () => {
      const res = await fetch('import.meta.env.VITE_AUTHCOMPLETE');

      if (res.ok) {
        navigate('/install');
      }
    };
    completeAuth();
  }, [navigate]);

  return <div className="p-4">Authenticating with GitHub...</div>;
};

export default AuthCallback;
