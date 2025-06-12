import React, { useEffect, useState } from 'react';

type Org = {
  id: number;
  login: string;
};

const OrgSelector: React.FC<{
  onSelect: (org: string) => void;
}> = ({ onSelect }) => {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(
    'Loading organizations...'
  );

  useEffect(() => {
    let isMounted = true; // Prevent state updates if component unmounts
    let fetchPromise: Promise<void> | null = null; // Deduplicate requests
    let timeoutId: NodeJS.Timeout;

    const fetchOrgs = async (retryCount = 0) => {
      // Prevent duplicate requests
      if (fetchPromise) {
        return fetchPromise;
      }

      fetchPromise = (async () => {
        try {
          if (!isMounted) return;

          setError(null);
          setLoadingMessage(
            retryCount > 0
              ? `Retrying... (${retryCount + 1}/3)`
              : 'Loading organizations...'
          );
          console.log('🌐 Fetching organizations...');

          // Add timeout to prevent hanging requests
          const controller = new AbortController();
          timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

          const res = await fetch('/api/auth/orgs', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Cache-Control': 'no-cache',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!isMounted) return;

          if (!res.ok) {
            if (res.status === 401) {
              throw new Error('Authentication required. Please log in again.');
            }
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }

          const data = await res.json();
          console.log('👉 orgs from server:', data);

          if (!isMounted) return;

          if (!Array.isArray(data)) {
            console.error('Expected array of orgs but got:', data);
            setOrgs([]);
            setLoading(false);
            return;
          }

          setOrgs(data);
          setLoading(false);

          // Auto-select if only one organization
          if (data.length === 1) {
            console.log(
              '🎯 Auto-selecting single organization:',
              data[0].login
            );
            onSelect(data[0].login);
          }
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (!isMounted) return;

          if (err.name === 'AbortError') {
            console.error('❌ Request timed out');
            setError('Request timed out. Please try again.');
          } else {
            console.error('❌ Failed to fetch organizations:', err);

            // Retry logic for network errors (but not auth errors)
            if (
              retryCount < 2 &&
              !err.message.includes('Authentication') &&
              err.name !== 'AbortError'
            ) {
              console.log(`🔄 Retrying... (${retryCount + 1}/2)`);
              setTimeout(() => {
                fetchPromise = null; // Reset promise for retry
                fetchOrgs(retryCount + 1);
              }, 1000 * (retryCount + 1));
              return;
            }

            setError(err.message || 'Failed to load organizations');
          }
          setLoading(false);
        } finally {
          fetchPromise = null; // Reset for future calls
        }
      })();

      return fetchPromise;
    };

    fetchOrgs();

    return () => {
      isMounted = false; // Cleanup to prevent state updates
      clearTimeout(timeoutId); // Clear any pending timeouts
    };
  }, []); // No dependencies to prevent re-runs

  if (loading)
    return (
      <div className='min-h-screen bg-[#171717] flex items-center justify-center'>
        <div className='bg-[#212121] border border-[#303030] rounded-2xl shadow-lg p-8 max-w-md mx-auto text-center'>
          <div className='w-8 h-8 border-2 border-[#5ea9ea] border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
          <p className='text-[#888] text-sm'>{loadingMessage}</p>
        </div>
      </div>
    );

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
