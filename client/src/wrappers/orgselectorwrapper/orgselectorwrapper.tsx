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

  // When credentials are missing or expired, send user to login immediately so they can get new ones (no automatic refresh with GitHub OAuth).
  useEffect(() => {
    let isMounted = true;

    const checkForToken = async () => {
      const localToken = localStorage.getItem('githubToken');
      if (localToken && localToken.length >= 20) {
        if (isMounted) setWaitingForToken(false);
        return;
      }

      try {
        const token = await getGithubToken();
        if (token && token.length >= 20 && isMounted) {
          setWaitingForToken(false);
          return;
        }
      } catch {
        // getGithubToken already redirects to /login?expired=true on 401; if it threw for another reason, still send to login so user can re-auth
        if (isMounted) navigate('/login?expired=true');
        return;
      }

      // No token in localStorage and backend didn't return one (e.g. no cookies) — go to login to get credentials
      if (isMounted) navigate('/login?expired=true');
    };

    checkForToken();
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
      }`,
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
