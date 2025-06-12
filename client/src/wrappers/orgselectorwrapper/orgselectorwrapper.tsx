import { useState, useContext } from 'react';
import OrgSelector from '../../components/auth/orgselector';
import { useNavigate } from 'react-router-dom';
import { IngestionContext } from '../../components/ingestion/ingestioncontext';

const OrgSelectorWrapper = () => {
  // Since tokens are in HTTP-only cookies, we don't need to pass token to OrgSelector
  // The backend will read from cookies directly
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const context = useContext(IngestionContext);
  const navigate = useNavigate();

  // Debug: Track component mount timing
  console.log('🚀 OrgSelectorWrapper mounted at:', new Date().toISOString());

  const handleSelectOrg = (org: string, installationId?: string) => {
    setSelectedOrg(org);
    // Update context immediately when user selects org
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

  return (
    <div>
      <OrgSelector onSelect={handleSelectOrg} />
      {selectedOrg && <div>Selected org: {selectedOrg}</div>}
    </div>
  );
};

export default OrgSelectorWrapper;
