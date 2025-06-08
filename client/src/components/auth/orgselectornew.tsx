import React, { useEffect, useState } from 'react';
type Org = {
  id: number;
  login: string;
};
interface OrgSelectorProps {
  token: string;
  onSelect: (org: string) => void;
}
const OrgSelector: React.FC<OrgSelectorProps> = ({ token, onSelect }) => {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!token) {
      setError('Missing authentication token.');
      setLoading(false);
      return;
    }
    const fetchOrgs = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('http://localhost:4000/api/auth/orgs', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (res.status === 401) {
            setError('Unauthorized. Please log in again.');
          } else {
            setError(`Error fetching orgs: ${res.statusText}`);
          }
          setOrgs([]);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          setOrgs(data);
        } else {
          setOrgs([]);
          setError('API did not return a valid organization list.');
        }
      } catch (err) {
        setOrgs([]);
        setError('Network error. Please try again.');
        console.error('error failed', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrgs();
  }, [token]);
  // React-safe auto-select for single org
  useEffect(() => {
    if (!loading && !error && orgs.length === 1) {
      onSelect(orgs[0].login);
    }
  }, [loading, orgs, error, onSelect]);
  if (loading) return <div>Loading organizations ...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (orgs.length === 0)
    return <div>No organizations found for this user.</div>;
  if (orgs.length === 1) return null;
  return (
    <select onChange={(e) => onSelect(e.target.value)} defaultValue=''>
      <option value=''>Select Organization</option>
      {orgs.map((org) => (
        <option key={org.id} value={org.login}>
          {org.login}
        </option>
      ))}
    </select>
  );
};
export default OrgSelector;
