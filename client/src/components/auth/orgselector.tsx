import React, { useEffect, useState } from 'react';
import { apiBaseUrl } from '../../utils/api';

type Org = {
  id: number;
  login: string;
  isPersonal?: boolean; // Flag to identify personal account
};

const OrgSelector: React.FC<{
  token: string;
  onSelect: (org: string) => void;
}> = ({ token, onSelect }) => {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrgs = async () => {
      if (!token) {
        console.error('❌ No token provided to OrgSelector');
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Fetching orgs with token from localStorage');
        console.log('📋 Token details:', {
          hasToken: !!token,
          tokenLength: token?.length || 0,
          tokenPrefix: token?.substring(0, 10) || 'none',
        });

        const headers: HeadersInit = {
          'Cache-Control': 'no-cache',
          Authorization: `Bearer ${token}`, // Send token in header for Safari compatibility
        };

        console.log('📤 Request headers:', {
          hasAuthorization: !!headers.Authorization,
          authorizationPrefix:
            headers.Authorization?.substring(0, 20) || 'none',
        });

        const res = await fetch(`${apiBaseUrl}/auth/orgs`, {
          method: 'GET',
          credentials: 'include', // Still try to send cookies as fallback
          headers,
        });

        console.log('📥 Response received:', {
          status: res.status,
          statusText: res.statusText,
          ok: res.ok,
        });

        if (!res.ok) {
          const errorData = await res
            .json()
            .catch(() => ({ error: 'Unknown error' }));
          console.error('❌ Failed to fetch orgs:', res.status, errorData);
          if (res.status === 401) {
            console.error('Token expired or invalid, redirecting to login');
            // Token might be expired, clear it
            localStorage.removeItem('githubToken');
            localStorage.removeItem('jwt');
            window.location.href = '/login?expired=true';
          }
          setOrgs([]);
          setLoading(false);
          return;
        }

        const data = await res.json();
        console.log('✅ Orgs fetched successfully:', data);

        if (!Array.isArray(data)) {
          console.error('Expected array of orgs but got:', data);
          setOrgs([]);
          return;
        }
        setOrgs(data);
        setLoading(false);
      } catch (err) {
        console.error('❌ Network error fetching orgs:', err);
        setOrgs([]);
        setLoading(false);
      }
    };
    fetchOrgs();
  }, [token]);

  if (loading) return <div> Loading organizations ...</div>;
  if (orgs.length === 1) {
    onSelect(orgs[0].login);
    return null;
  }
  return (
    <div className='flex items-center justify-center min-h-screen bg-black'>
      <select
        onChange={(e) => onSelect(e.target.value)}
        className='text-black bg-white px-4 py-2 rounded-md border border-gray-300 text-base'
      >
        <option value=''>Select Organization or Personal Account</option>
        {orgs.map((org) => (
          <option key={org.id} value={org.login}>
            {org.isPersonal ? `${org.login} (Personal)` : org.login}
          </option>
        ))}
      </select>
    </div>
  );
};

export default OrgSelector;
