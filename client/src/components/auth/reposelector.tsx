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

  // Helper: Parse query params
  function getInstallationId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('installation_id') || '';
  }

  useEffect(() => {
    const id = getInstallationId();
    setInstallationId(id);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch('/api/auth/repos', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json() as Promise<Repo[]>;
      })
      .then(setRepos)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
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
        {loading && <p className='text-gray-500'>Loading repositories...</p>}
        {error && (
          <div className='p-3 bg-red-100 text-red-800 rounded mb-4'>
            Error: {error}
          </div>
        )}

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
          className='px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700'
          disabled={!selectedRepo}
        >
          🚀 Ingest Repo
        </button>
      </div>
    </div>
  );
};

export default RepoSelector;
