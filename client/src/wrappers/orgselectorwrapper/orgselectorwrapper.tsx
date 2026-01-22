import { useState, useContext, useEffect } from 'react';
import OrgSelector from '../../components/auth/orgselector';
import { useNavigate } from 'react-router-dom';
import { IngestionContext } from '../../components/ingestion/ingestioncontext';
import { getGithubToken } from '../../api';

const OrgSelectorWrapper = () => {
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [waitingForToken, setWaitingForToken] = useState(true);
  const context = useContext(IngestionContext);
  const navigate = useNavigate();

  // Debug: Track component mount timing
  console.log('🚀 OrgSelectorWrapper mounted at:', new Date().toISOString());

  // Wait for token to be available (check localStorage first, then fallback to backend)
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 5; // 5 retries * 200ms = 1 second for localStorage check
    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const checkForToken = async () => {
      // First, check localStorage (fastest path)
      const localToken = localStorage.getItem('githubToken');
      if (localToken && localToken.length >= 20) {
        console.log('✅ OrgSelectorWrapper: Token found in localStorage');
        if (isMounted) setWaitingForToken(false);
        return;
      }

      // If not in localStorage after a few retries, try fetching from backend
      // getGithubToken() already has fallback logic to fetch from backend cookies
      if (retryCount >= 2) {
        try {
          console.log('⚠️ OrgSelectorWrapper: Token not in localStorage, fetching from backend...');
          const token = await getGithubToken();
          if (token && token.length >= 20) {
            console.log('✅ OrgSelectorWrapper: Token retrieved from backend');
            if (isMounted) setWaitingForToken(false);
            return;
          }
        } catch (error) {
          console.error('❌ OrgSelectorWrapper: Failed to fetch token from backend:', error);
          // If getGithubToken throws, it means token is expired/invalid - redirect will happen in getGithubToken
          // But we should still try one more time before giving up
        }
      }

      // Retry logic
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`⏳ OrgSelectorWrapper: Waiting for token... (attempt ${retryCount}/${maxRetries})`);
        timeoutId = setTimeout(checkForToken, 200);
      } else {
        // Final check - if still no token, redirect to login
        const finalToken = localStorage.getItem('githubToken');
        if (!finalToken || finalToken.length < 20) {
          console.error('❌ OrgSelectorWrapper: No token found after retries, redirecting to login');
          if (isMounted) navigate('/login?expired=true');
        } else {
          if (isMounted) setWaitingForToken(false);
        }
      }
    };

    // Start checking
    checkForToken();

    // Cleanup timeout on unmount
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [navigate]);

  const handleSelectOrg = (org: string, installationId?: string) => {
    setSelectedOrg(org);
    if (context) {
      context.setSelectedOrg(org);
      if (installationId) {
        context.setInstallationId(installationId);
      }
    }
    navigate(
      `/select-repo?org=${org}${
        installationId ? `&installation_id=${installationId}` : ''
      }`
    );
  };

  if (waitingForToken) {
    return (
      <div className='min-h-screen bg-[#171717] flex items-center justify-center'>
        <div className='text-[#fafafa]'>Loading authentication...</div>
      </div>
    );
  }

  return (
    <div>
      <OrgSelector onSelect={handleSelectOrg} />
      {selectedOrg && <div>Selected org: {selectedOrg}</div>}
    </div>
  );
};

export default OrgSelectorWrapper;
