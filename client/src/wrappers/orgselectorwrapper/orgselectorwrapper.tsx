import React, { useState, useContext } from 'react';
import OrgSelector from '../../components/auth/orgselector';
import { useNavigate } from 'react-router-dom';
import { IngestionContext } from '../../components/ingestion/ingestioncontext';

const OrgSelectorWrapper = () => {
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const context = useContext(IngestionContext);
  const navigate = useNavigate();

  const handleSelectOrg = (org: string, installationId?: string) => {
    setSelectedOrg(org);
    if (context) {
      context.setSelectedOrg(org);
      if (installationId) {
        context.setInstallationId(installationId);
      }
    }
    navigate(`/select-repo?org=${org}${installationId ? `&installation_id=${installationId}` : ''}`);
  };

  return (
    <div>
      <OrgSelector onSelect={handleSelectOrg} />
      {selectedOrg && <div>Selected org: {selectedOrg}</div>}
    </div>
  );
};

export default OrgSelectorWrapper;
