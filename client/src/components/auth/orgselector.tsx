import React, { useEffect, useState } from 'react';

type Org = {
  id: number;
  login: string;
};

const OrgSelector: React.FC<{
  token: string;
  onSelect: (org: string) => void;
}> = ({ token, onSelect }) => {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrgs = async () => {
      if (!token) return;
      const res = await fetch('http://localhost:4000/api/auth/orgs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setOrgs(data);
      setLoading(false);
    };
    fetchOrgs();
  }, [token]);

  if (loading) return <div> Loading organizations ...</div>;
  if (orgs.length === 1) {
    onSelect(orgs[0].login);
    return null;
  }
  return (
    <select onChange={(e) => onSelect(e.target.value)}>
      <option value="">Select Organization</option>
      {orgs.map((org) => (
        <option key={org.id} value={org.login}>
          {org.login}
        </option>
      ))}
    </select>
  );
};

export default OrgSelector;
