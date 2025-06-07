import { useState } from 'react';
import OrgSelector from '../../components/auth/orgselector';
import { useNavigate } from 'react-router-dom';

const OrgSelectorWrapper = () => {
  const githubToken = localStorage.getItem('githubToken');
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleSelectOrg = (org: string) => {
    setSelectedOrg(org);
    navigate(`/select-repo?org=${org}`);
  };

  return (
    <div>
      <OrgSelector token={githubToken ?? ''} onSelect={handleSelectOrg} />
      {selectedOrg && <div>Selected org: {selectedOrg}</div>}
    </div>
  );
};

export default OrgSelectorWrapper;
