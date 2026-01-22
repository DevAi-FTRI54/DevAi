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

  /**
   * This effect handles the tricky business of getting our GitHub token ready before we show the org selector.
   * 
   * Here's the situation: Safari can be a bit finicky with localStorage, sometimes clearing it when we least expect it.
   * But we're smart about this - we check localStorage first (it's the fastest), and if that doesn't work out,
   * we gracefully fall back to asking our backend for the token (which stores it in cookies that Safari treats better).
   * 
   * We give it a few gentle retries because sometimes the auth callback is still writing the token when this component
   * mounts, and we want to be patient rather than immediately giving up. It's like checking if your friend is ready
   * before knocking on their door - sometimes they just need a moment!
   */
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 5; // 5 retries * 200ms = 1 second for localStorage check
    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true; // Track if component is still mounted to avoid state updates after unmount

    const checkForToken = async () => {
      // First, let's check localStorage - it's the fastest path and works great in most browsers
      // We're looking for a token that's at least 20 characters (GitHub tokens are typically 40+ chars)
      const localToken = localStorage.getItem('githubToken');
      if (localToken && localToken.length >= 20) {
        console.log('✅ OrgSelectorWrapper: Token found in localStorage');
        if (isMounted) setWaitingForToken(false);
        return;
      }

      // If we've tried a couple times and still don't have a token in localStorage, let's be smart about it.
      // Safari might have cleared it, or maybe it was never there. Either way, our backend has our back!
      // The getGithubToken() function is really helpful here - it checks localStorage first, then falls back
      // to fetching from backend cookies, which Safari preserves much better. It's like having a backup plan!
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
          // If getGithubToken throws, it means the token is expired or invalid - the function will handle
          // redirecting to login, but we'll still give it one more shot before we completely give up.
          // Sometimes network hiccups happen, and we want to be resilient!
        }
      }

      // Our retry logic - we'll check up to 5 times, waiting 200ms between each check.
      // This gives the auth callback time to finish storing the token if it's still working on it.
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`⏳ OrgSelectorWrapper: Waiting for token... (attempt ${retryCount}/${maxRetries})`);
        timeoutId = setTimeout(checkForToken, 200);
      } else {
        // Alright, we've been patient. If we still don't have a token after all our retries,
        // it's time to gracefully redirect the user back to login. They'll need to authenticate again,
        // but at least we're not leaving them stuck on a loading screen forever!
        const finalToken = localStorage.getItem('githubToken');
        if (!finalToken || finalToken.length < 20) {
          console.error('❌ OrgSelectorWrapper: No token found after retries, redirecting to login');
          if (isMounted) navigate('/login?expired=true');
        } else {
          // Hey, we found it on the last check! Sometimes persistence pays off.
          if (isMounted) setWaitingForToken(false);
        }
      }
    };

    // Let's start checking for that token right away!
    checkForToken();

    // Cleanup is important - we don't want to leave timeouts running if the component unmounts.
    // It's like turning off the lights when you leave a room - good housekeeping!
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
