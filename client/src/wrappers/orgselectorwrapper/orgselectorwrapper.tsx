import { useState, useContext, useEffect } from 'react';
import OrgSelector from '../../components/auth/orgselector';
import { useNavigate } from 'react-router-dom';
import { IngestionContext } from '../../components/ingestion/ingestioncontext';

const OrgSelectorWrapper = () => {
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [waitingForToken, setWaitingForToken] = useState(true);
  const context = useContext(IngestionContext);
  const navigate = useNavigate();

  // Debug: Track component mount timing
  console.log('🚀 OrgSelectorWrapper mounted at:', new Date().toISOString());

  // Wait for token to be available (in case auth callback is still storing it)
  useEffect(() => {
    const checkForToken = () => {
      const token = localStorage.getItem('githubToken');
      if (token) {
        console.log('✅ OrgSelectorWrapper: Token found in localStorage');
        setWaitingForToken(false);
      } else {
        console.log('⏳ OrgSelectorWrapper: Waiting for token...');
        // Retry after a short delay
        setTimeout(checkForToken, 100);
      }
    };

    // Check immediately
    checkForToken();

    // Timeout after 5 seconds - if no token by then, redirect to login
    const timeout = setTimeout(() => {
      if (!localStorage.getItem('githubToken')) {
        console.error('❌ OrgSelectorWrapper: No token found after 5 seconds, redirecting to login');
        navigate('/login?expired=true');
      }
    }, 5000);

    return () => clearTimeout(timeout);
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
