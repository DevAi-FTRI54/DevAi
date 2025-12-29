import { useState, useEffect } from 'react';
import OrgSelector from '../../components/auth/orgselector';
import { useNavigate } from 'react-router-dom';

const OrgSelectorWrapper = () => {
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [waitingForToken, setWaitingForToken] = useState(true);

  const navigate = useNavigate();

  // Wait for token to be available (in case auth callback is still storing it)
  useEffect(() => {
    const checkForToken = () => {
      const token = localStorage.getItem('githubToken');
      if (token) {
        console.log('✅ OrgSelectorWrapper: Token found in localStorage');
        setGithubToken(token);
        setWaitingForToken(false);
      } else {
        console.log('⏳ OrgSelectorWrapper: Waiting for token...');
        // Retry after a short delay
        setTimeout(checkForToken, 100);
      }
    };

    // Check immediately
    checkForToken();

    // Also listen for storage events (in case token is set in another tab/window)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'githubToken' && e.newValue) {
        console.log('✅ OrgSelectorWrapper: Token received via storage event');
        setGithubToken(e.newValue);
        setWaitingForToken(false);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Timeout after 5 seconds - if no token by then, redirect to login
    const timeout = setTimeout(() => {
      if (!localStorage.getItem('githubToken')) {
        console.error(
          '❌ OrgSelectorWrapper: No token found after 5 seconds, redirecting to login'
        );
        navigate('/login?expired=true');
      }
    }, 5000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearTimeout(timeout);
    };
  }, [navigate]);

  const handleSelectOrg = (org: string) => {
    setSelectedOrg(org);
    navigate(`/select-repo?org=${org}`);
  };

  if (waitingForToken) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-black'>
        <div className='font-tt-hoves p-4 text-white'>
          Loading authentication...
        </div>
      </div>
    );
  }

  if (!githubToken) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-black'>
        <div className='font-tt-hoves p-4 text-red-400'>
          Authentication required. Redirecting to login...
        </div>
      </div>
    );
  }

  return (
    <div>
      <OrgSelector token={githubToken} onSelect={handleSelectOrg} />
      {selectedOrg && <div>Selected org: {selectedOrg}</div>}
    </div>
  );
};

export default OrgSelectorWrapper;
