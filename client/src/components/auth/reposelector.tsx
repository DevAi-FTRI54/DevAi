import React, { useEffect, useState } from 'react';

type Repo = {
  id: number;
  full_name: string;
  html_url: string;
  sha: string;
};

interface RepoSelectorProps {
  onStartIngestion: (jobId: string, repo: Repo) => void;
}

const RepoSelector: React.FC<RepoSelectorProps> = ({ onStartIngestion }) => {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setRepo] = useState<Repo | null>(null);
  const [installationId, setInstallationId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [autoRetryAttempts, setAutoRetryAttempts] = useState(0);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    console.log('Loading state:', loading);
    console.log('Repos length:', repos.length);
    console.log('Error:', error);
    console.log('Auto retry attempts:', autoRetryAttempts);
  }, [loading, repos.length, error, autoRetryAttempts]);

  // Helper: Parse query params
  function getInstallationId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('installation_id') || '';
  }

  useEffect(() => {
    const id = getInstallationId();
    setInstallationId(id);
  }, []);

  const fetchRepos = async (attempt = 0, isRetry = false) => {
    if (!isRetry) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await fetch('/api/auth/repos', {
        credentials: 'include',
      });

      if (!response.ok) {
        // Error: Auth
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in again.');
        }
        // Error: App installation
        if (response.status === 400) {
          throw new Error(
            'Github App installation not found. Please install the app first.'
          );
        }
        // Error: Backend (typically, DBs are not ready yet)
        if (response.status === 503) {
          throw new Error('Service temporarily unavailable. Retrying...');
        }
        throw new Error(`Failed to load repositories (${response.status})`);
      }

      const data = (await response.json()) as Repo[];

      // Auto-retry if no repos found (timing issue)
      if (data.length === 0 && autoRetryAttempts < 3) {
        console.log(`Auto-retrying... (${autoRetryAttempts + 1}/3)`);

        setTimeout(() => {
          setAutoRetryAttempts((prev) => prev + 1);
          fetchRepos(0, true);
        }, 1000);
        return;
      }

      setRepos(data);
      setRetryCount(0);
      setAutoRetryAttempts(0);
      setLoading(false);
      setInitializing(false);
    } catch (err: any) {
      console.error('Fetch repos error:', err);
      setError(err.message);

      // Retry Attempt: General case
      if (attempt < 3) {
        console.log(
          `Retrying in ${(attempt + 1) * 1000}ms... (attempt ${
            attempt + 1
          } / 3)`
        );
        setTimeout(() => {
          setRetryCount(attempt + 1);
          fetchRepos(attempt + 1);
        }, (attempt + 1) * 1000);
        return;
      }
      setLoading(false);
      setInitializing(false);
    }
  };

  // Invoke fetchRepos with frontend delay
  useEffect(() => {
    // Show loading immediately, then wait for cookies to settle
    setLoading(true);
    setInitializing(true);

    // Wait 2 seconds for cookies to settle, then fetch
    setTimeout(() => {
      fetchRepos();
    }, 2000);
  }, []);

  const handleSelect = async () => {
    if (!selectedRepo) return;

    try {
      const res = await fetch('/api/index/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: selectedRepo.html_url,
          sha: selectedRepo.sha,
          installation_id: installationId,
        }),
      });

      if (!res.ok) throw new Error(`Ingestion failed`);
      const body = await res.json();
      const jobId: string = body.jobId;

      onStartIngestion(jobId, selectedRepo);
      alert(`Started ingesting ${selectedRepo.full_name}`);
    } catch (error) {
      console.error('Error indexing repo:', error);
      alert(`Failed to start ingestion. Please try again.`);
    }
  };

  return (
    <div className='min-h-screen w-full bg-[#23262f] flex items-center justify-center'>
      <div className='p-6 max-w-xl mx-auto'>
        <h2 className='text-xl font-bold mb-4'>Select a repository to index</h2>

        {/* Loading repos */}
        {loading && (
          <div className='text-gray-300 flex items-center gap-2'>
            <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
            {initializing ? 'Initializing...' : 'Loading repositories...'}
            {autoRetryAttempts > 0 && (
              <span>(auto-retry {autoRetryAttempts}/3)</span>
            )}
            {retryCount > 0 && <span>(retry {retryCount}/3)</span>}
          </div>
        )}

        {/* Error (likely due to cookies not being set yet) */}
        {error && (
          <div className='p-3 bg-red-100 text-red-800 rounded mb-4'>
            <p className='font-semibold'>Error: {error}</p>
            <div className='mt-2 flex gap-2'>
              <button
                onClick={() => {
                  setAutoRetryAttempts(0);
                  setRetryCount(0);
                  fetchRepos();
                }}
                className='px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm'
              >
                Try Again
              </button>
              {error.includes('Authentication') && (
                <button
                  onClick={() => (window.location.href = '/api/auth/github')}
                  className='px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm'
                >
                  Re-authenticate
                </button>
              )}
            </div>
          </div>
        )}

        {/* No repos found */}
        {!loading && !error && repos.length === 0 && !initializing && (
          <div className='p-3 bg-yellow-100 text-yellow-800 rounded mb-4'>
            <p className='font-semibold'>No repositories found</p>
            <p className='text-sm mb-3'>
              Please try refreshing or check your GitHub App installation.
            </p>
            <div className='flex gap-2'>
              <button
                onClick={() => window.location.reload()}
                className='px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm'
              >
                🔄 Refresh Page
              </button>
              <button
                onClick={() => {
                  setAutoRetryAttempts(0);
                  setRetryCount(0);
                  fetchRepos();
                }}
                className='px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm'
              >
                🔄 Retry
              </button>
              <button
                onClick={() => (window.location.href = '/install-github-app')}
                className='px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm'
              >
                ⚙️ Install App
              </button>
            </div>
          </div>
        )}

        {repos.length > 0 && (
          <>
            <select
              className='w-full p-2 border rounded mb-4'
              value={selectedRepo?.id ?? ''}
              onChange={(e) => {
                const repo = repos.find((r) => r.id === Number(e.target.value));
                setRepo(repo ?? null);
              }}
            >
              <option value=''>-- Choose a repo --</option>
              {repos.map((repo: Repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.full_name}
                </option>
              ))}
            </select>

            <button
              onClick={handleSelect}
              className='px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50'
              disabled={!selectedRepo}
            >
              🚀 Ingest Repo
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default RepoSelector;
