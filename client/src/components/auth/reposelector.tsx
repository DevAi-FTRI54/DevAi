import React, { useContext, useEffect, useState } from 'react';
import { IngestionContext } from '../../components/ingestion/ingestioncontext';
import type { Repo } from '../../types';
import type { RepoSelectorProps } from '../../types';

// Helper: Parse query params
function getQueryParam(name: string) {
  const params = new URLSearchParams(window.location.search);
  console.log('--- params ---------');
  console.log(params);
  return params.get(name) || '';
}

const RepoSelector: React.FC<RepoSelectorProps> = ({
  onStartIngestion,
  compact = false,
  org,
  installationId,
}) => {
  // Context (optional, may be undefined)
  const context = useContext(IngestionContext);
  const contextOrg = context?.selectedOrg;
  const contextInstallationId = context?.installationId;

  // Org/installationId: logic depends on compact mode
  let selectedOrgToUse: string | undefined;
  let effectiveInstallationId: string | undefined;

  console.log('--- repoSelector.tsx ---------');
  console.log(compact);
  console.log(org);
  console.log(installationId);

  if (compact) {
    // In compact mode, always use context (which should be updated globally on org select)
    selectedOrgToUse = org ?? contextOrg ?? getQueryParam('org');
    effectiveInstallationId =
      installationId ??
      contextInstallationId ??
      getQueryParam('installation_id');
  } else {
    // In standard mode, use props if provided, else context/query
    selectedOrgToUse = org ?? contextOrg ?? getQueryParam('org');
    effectiveInstallationId =
      installationId ??
      contextInstallationId ??
      getQueryParam('installation_id');
  }

  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setRepo] = useState<Repo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRetryAttempts, setAutoRetryAttempts] = useState(0);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // For debugging
    console.log('Repos length:', repos.length);
    console.log('Error:', error);
    console.log('Auto retry attempts:', autoRetryAttempts);
  }, [loading, repos.length, error, autoRetryAttempts]);

  const fetchRepos = async (attempt = 0, isRetry = false) => {
    if (!isRetry) {
      setLoading(true);
      setError(null);
    }

    try {
      // Compose query string
      const orgQuery = selectedOrgToUse
        ? `org=${encodeURIComponent(selectedOrgToUse)}`
        : '';
      const installQuery = effectiveInstallationId
        ? `installation_id=${encodeURIComponent(effectiveInstallationId)}`
        : '';
      const query = [orgQuery, installQuery].filter(Boolean).join('&');
      const response = await fetch(
        `/api/auth/repos${query ? '?' + query : ''}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        if (response.status === 401)
          throw new Error('Authentication required. Please log in again.');
        if (response.status === 400)
          throw new Error(
            'Github App installation not found. Please install the app first.'
          );
        if (response.status === 503)
          throw new Error('Service temporarily unavailable. Retrying...');
        throw new Error(`Failed to load repositories (${response.status})`);
      }

      const data = (await response.json()) as Repo[];

      if (data.length === 0 && autoRetryAttempts < 3) {
        console.log(`Auto-retrying... (${autoRetryAttempts + 1}/3)`);
        setTimeout(() => {
          setAutoRetryAttempts((prev) => prev + 1);
          fetchRepos(0, true);
        }, 1000);
        return;
      }

      setRepos(data);
      setAutoRetryAttempts(0);
      setLoading(false);
      setInitializing(false);
    } catch (err: unknown) {
      console.error('Fetch repos error:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      if (attempt < 3) {
        console.log(
          `Retrying in ${(attempt + 1) * 1000}ms... (attempt ${
            attempt + 1
          } / 3)`
        );
        setTimeout(() => {
          fetchRepos(attempt + 1);
        }, (attempt + 1) * 1000);
        return;
      }
      setLoading(false);
      setInitializing(false);
    }
  };

  // Fetch repos whenever selectedOrgToUse changes
  useEffect(() => {
    setLoading(true);
    setInitializing(true);
    setTimeout(() => {
      fetchRepos();
    }, 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgToUse, effectiveInstallationId]);

  useEffect(() => {
    console.log(
      'RepoSelector using org:',
      selectedOrgToUse,
      'installationId:',
      effectiveInstallationId
    );
  }, [selectedOrgToUse, effectiveInstallationId]);

  const handleSelect = async () => {
    if (!selectedRepo) return;

    try {
      const res = await fetch('/api/index/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: selectedRepo.html_url,
          sha: selectedRepo.sha,
          installation_id: effectiveInstallationId,
        }),
      });

      if (!res.ok) throw new Error(`Ingestion failed`);
      const body = await res.json();
      const jobId: string = body.jobId;

      onStartIngestion(jobId, selectedRepo);
      console.log(`✅ Started ingesting ${selectedRepo.full_name}`);
    } catch (error) {
      console.error('Error indexing repo:', error);
      setError('Failed to start ingestion. Please try again.');
    }
  };

  return (
    <div
      className={
        compact
          ? 'w-full'
          : 'min-h-screen w-full bg-[#171717] flex items-center justify-center'
      }
    >
      <div
        className={
          compact
            ? 'w-full'
            : 'bg-[#212121] border border-[#303030] rounded-2xl shadow-lg p-8 max-w-md mx-auto'
        }
      >
        {!compact && (
          <div className='text-center mb-6'>
            <div className='w-12 h-12 bg-gradient-to-br from-[#5ea9ea] to-[#4a9ae0] rounded-xl flex items-center justify-center mx-auto mb-4'>
              <svg
                className='w-6 h-6 text-white'
                fill='currentColor'
                viewBox='0 0 20 20'
              >
                <path d='M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z' />
              </svg>
            </div>
            <h2 className='text-lg font-semibold text-[#fafafa] mb-2'>
              Select Repository
            </h2>
            <p className='text-[#888] text-sm'>
              Select a repository to index and analyze
            </p>
          </div>
        )}

        <h3
          className={
            compact
              ? 'text-xs font-medium text-[#888] uppercase tracking-wider mb-2'
              : 'sr-only'
          }
        >
          {compact ? 'Repository Selection' : 'Select a repository to index'}
        </h3>

        {loading && (
          <div
            className={
              compact
                ? 'text-xs text-[#888] flex items-center gap-1.5 mb-2'
                : 'text-[#888] flex items-center gap-2 justify-center mb-4'
            }
          >
            <div
              className={
                compact
                  ? 'w-3 h-3 border border-[#5ea9ea] border-t-transparent rounded-full animate-spin'
                  : 'w-4 h-4 border-2 border-[#5ea9ea] border-t-transparent rounded-full animate-spin'
              }
            ></div>
            <span className={compact ? 'text-xs' : 'text-sm'}>
              {initializing ? 'Initializing...' : 'Loading repositories...'}
            </span>
            {autoRetryAttempts > 0 && (
              <span>(retry {autoRetryAttempts}/3)</span>
            )}
          </div>
        )}

        {error && (
          <div
            className={
              compact
                ? 'p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg mb-2 text-xs'
                : 'p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg mb-4 text-sm'
            }
          >
            <p className='font-medium'>Error: {error}</p>
          </div>
        )}

        {repos.length > 0 && (
          <div className={compact ? 'space-y-2' : 'space-y-4'}>
            <select
              className={
                compact
                  ? 'w-full text-xs p-2 bg-[#303030] border border-[#404040] rounded-lg text-[#fafafa] focus:outline-none focus:border-[#5ea9ea] transition-colors'
                  : 'w-full bg-[#303030] border border-[#404040] text-[#fafafa] px-4 py-3 rounded-lg focus:outline-none focus:border-[#5ea9ea] transition-colors'
              }
              value={selectedRepo?.id ?? ''}
              onChange={(e) => {
                const repo = repos.find((r) => r.id === Number(e.target.value));
                setRepo(repo ?? null);
              }}
            >
              <option value=''>Select a repository</option>
              {repos.map((repo: Repo) => (
                <option key={repo.id} value={repo.id} className='bg-[#303030]'>
                  {repo.full_name}
                </option>
              ))}
            </select>

            <button
              onClick={handleSelect}
              className={
                compact
                  ? 'w-full text-xs px-3 py-1.5 bg-[#5ea9ea] hover:bg-[#4a9ae0] disabled:bg-[#404040] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  : 'w-full px-4 py-3 bg-[#5ea9ea] hover:bg-[#4a9ae0] disabled:bg-[#404040] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
              }
              disabled={!selectedRepo}
            >
              {compact ? 'Ingest Repository' : 'Start Repository Ingestion'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RepoSelector;
