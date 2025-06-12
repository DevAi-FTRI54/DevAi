import React, { useEffect, useState } from 'react';
import { getUserOrgs } from '../../api'; // adjust path as needed

type Org = { id: number; login: string };

const OrgSelector: React.FC<{ onSelect: (org: string) => void }> = ({ onSelect }) => {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const orgs = await getUserOrgs(); // No token passed
        setOrgs(orgs);
      } catch (err) {
        console.error('Failed to load orgs:', err);
        setOrgs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOrgs();
  }, []);

  if (loading) return <div>Loading organizations ...</div>;
  if (orgs.length === 1) {
    onSelect(orgs[0].login);
    return null;
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800">
      <h2 className="text-xl font-bold mb-4" style={{ color: '#fff' }}>
        Select an organization to index
      </h2>
      <select
        onChange={(e) => onSelect(e.target.value)}
        className="text-black bg-white px-4 py-2 rounded-md border border-gray-300 text-base"
      >
        <option value="">Select Organization</option>
        {orgs.map((org) => (
          <option key={org.id} value={org.login}>
            {org.login}
          </option>
        ))}
      </select>
    </div>
  );
};

export default OrgSelector;
