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
      const res = await fetch('https://a59d8fd60bb0.ngrok.app/api/auth/orgs', {
        method: 'GET',
        credentials: 'include', // 🔥 This sends the cookies
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      const data = await res.json();
      console.log('👉 orgs from server:', data); // ✅ Inspect here
      if (!Array.isArray(data)) {
        console.error('Expected array of orgs but got:', data);
        setOrgs([]);
        return;
      }
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800">
      <h2 className={'text-xl font-bold mb-4'} style={{ color: '#fff' }}>
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
