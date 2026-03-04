import { useState, useContext, useEffect } from 'react';
import OrgSelector from '../../components/auth/orgselector';
import { useNavigate } from 'react-router-dom';
import { IngestionContext } from '../../components/ingestion/ingestioncontext';
import { checkSession } from '../../api';

const OrgSelectorWrapper = () => {
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [waitingForToken, setWaitingForToken] = useState(true);
  const context = useContext(IngestionContext);
  const navigate = useNavigate();

  // Debug: Track component mount timing
  console.log('🚀 OrgSelectorWrapper mounted at:', new Date().toISOString());

  useEffect(() => {
    let isMounted = true;
    checkSession()
      .then(() => {
        if (isMounted) setWaitingForToken(false);
      })
      .catch(() => {
        if (isMounted) navigate('/login?expired=true');
      });
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
