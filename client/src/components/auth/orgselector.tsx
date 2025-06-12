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

  if (loading)
    return (
      <div className='min-h-screen bg-[#171717] flex items-center justify-center'>
        <div className='bg-[#212121] border border-[#303030] rounded-2xl shadow-lg p-8 max-w-md mx-auto text-center'>
          <div className='w-8 h-8 border-2 border-[#5ea9ea] border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
          <p className='text-[#888] text-sm'>Loading organizations...</p>
        </div>
      </div>
    );

  if (orgs.length === 1) {
    onSelect(orgs[0].login);
    return null;
  }

  return (
    <div className='min-h-screen bg-[#171717] flex flex-col items-center justify-center'>
      <div className='bg-[#212121] border border-[#303030] rounded-2xl shadow-lg p-8 max-w-md mx-auto'>
        <div className='text-center mb-6'>
          <div className='w-12 h-12 bg-gradient-to-br from-[#5ea9ea] to-[#4a9ae0] rounded-xl flex items-center justify-center mx-auto mb-4'>
            <svg
              className='w-6 h-6 text-white'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' />
            </svg>
          </div>
          <h2 className='text-lg font-semibold text-[#fafafa] mb-2'>
            Select Organization
          </h2>
          <p className='text-[#888] text-sm'>
            Choose which organization to index
          </p>
        </div>

        <select
          onChange={(e) => onSelect(e.target.value)}
          className='w-full bg-[#303030] border border-[#404040] text-[#fafafa] px-4 py-3 rounded-lg focus:outline-none focus:border-[#5ea9ea] transition-colors'
        >
          <option value=''>Select Organization</option>
          {orgs.map((org) => (
            <option key={org.id} value={org.login} className='bg-[#303030]'>
              {org.login}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default OrgSelector;
