import React, { useEffect, useState } from 'react';
import { getUserOrgs } from '../../api'; // adjust path as needed

type Org = {
  id: number;
  login: string;
  isPersonal?: boolean; // Flag to identify personal account
};

const OrgSelector: React.FC<{ onSelect: (org: string) => void }> = ({
  onSelect,
}) => {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const [loadingMessage, setLoadingMessage] = useState(
  //   'Loading organizations...'
  // );

  useEffect(() => {
    const fetchOrgs = async (retryCount = 0) => {
      try {
        // Get token from localStorage for Safari compatibility
        // Wait a bit if token isn't available yet (Safari timing issue)
        const githubToken = localStorage.getItem('githubToken');
        
        if (!githubToken && retryCount < 5) {
          console.log(`⏳ Token not found, retrying in 200ms... (attempt ${retryCount + 1}/5)`);
          setTimeout(() => fetchOrgs(retryCount + 1), 200);
          return;
        }
        
        console.log('🔍 Fetching orgs with token from localStorage:', {
          hasToken: !!githubToken,
          tokenLength: githubToken?.length || 0,
          tokenPrefix: githubToken?.substring(0, 10) || 'none',
        });
        
        if (!githubToken) {
          throw new Error('No GitHub token found. Please log in again.');
        }
        
        const orgs = await getUserOrgs(githubToken); // Pass token for Safari
        setOrgs(orgs);
        console.log('✅ Orgs fetched successfully:', orgs);
      } catch (err) {
        setOrgs([]);
        console.error('❌ Failed to load orgs:', err);
        if (err instanceof Error) {
          setError(err.message);
          // If token expired, redirect to login
          if (err.message.includes('expired') || err.message.includes('reauth') || err.message.includes('No GitHub token')) {
            setTimeout(() => {
              window.location.href = '/login?expired=true';
            }, 2000);
          }
        } else {
          setError('Unexpected error');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchOrgs();
  }, []);

  if (loading) return <div>Loading organizations ...</div>;
  // if (orgs.length === 1) {
  //   onSelect(orgs[0].login);
  //   return null;
  // }

  if (error)
    return (
      <div className='min-h-screen bg-[#171717] flex items-center justify-center'>
        <div className='bg-[#212121] border border-[#303030] rounded-2xl shadow-lg p-8 max-w-md mx-auto text-center'>
          <div className='w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mx-auto mb-4'>
            <svg
              className='w-6 h-6 text-red-400'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z'
                clipRule='evenodd'
              />
            </svg>
          </div>
          <h2 className='text-lg font-semibold text-[#fafafa] mb-2'>
            Error Loading Organizations
          </h2>
          <p className='text-red-400 text-sm mb-4'>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className='px-4 py-2 bg-[#5ea9ea] hover:bg-[#4a9ae0] text-white rounded-lg font-medium transition-colors'
          >
            Retry
          </button>
        </div>
      </div>
    );

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
          <option value=''>Select Organization or Personal Account</option>
          {orgs.map((org) => (
            <option key={org.id} value={org.login} className='bg-[#303030]'>
              {org.isPersonal ? `${org.login} (Personal)` : org.login}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default OrgSelector;
