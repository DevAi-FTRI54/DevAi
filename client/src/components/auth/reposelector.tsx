import React, { useEffect, useState } from 'react';

// Helper: Parse query params (optional - you can use a library like 'query-string' if you prefer)
function getInstallationId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('installation_id') || '';
}

type Repo = {
  id: number;
  full_name: string;
  html_url: string;
  sha: string;
};

const RepoSelector: React.FC = () => {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setRepo] = useState<Repo | null>(null);

  // const [selected, setSelected] = useState<string>('');
  const [installationId, setInstallationId] = useState<string>('');

  // On mount, parse the installation_id from URL
  useEffect(() => {
    const id = getInstallationId();
    setInstallationId(id);
  }, []);

  // Fetch repos when installationId is set
  useEffect(() => {
    fetch('/api/auth/repos', {
      credentials: 'include',
    })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json() as Promise<Repo[]>;
      })
      .then(setRepos)
      .catch(console.error);
  }, []);

  // Ingest selected repo
  const handleSelect = async () => {
    if (!selectedRepo) return;

    try {
      const res = await fetch('/api/index/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: selectedRepo?.html_url, // html_url
          sha: selectedRepo?.sha,
          installation_id: installationId,
        }), // Send installation_id too!
      });

      if (!res.ok) {
        throw new Error(`Ingestion failed`);
      }

      alert(`Started ingesting ${selectedRepo?.full_name}`);
    } catch (error) {
      console.error('Error indexing repo:', error);
      alert(`Failed to start ingestion. Please try again.`);
    }
  };

  return (
    <div className='p-6 max-w-xl mx-auto'>
      <h2 className='text-xl font-bold mb-4'>Select a repository to index</h2>

      {/* Dropdown to select a repository */}
      <select
        className='w-full p-2 border rounded mb-4'
        value={selectedRepo?.id ?? ''}
        // onChange={(e) => setSelected(e.target.value)}
        onChange={(e) => {
          const repo = repos.find((r) => r.id === Number(e.target.value));
          setRepo(repo ?? null);
        }}
      >
        <option value=''>-- Choose a repo --</option>
        {repos.map((repo: any) => (
          <option key={repo.id} value={repo.id}>
            {repo.full_name}
          </option>
        ))}
      </select>

      {/* Button to trigger the ingestion */}
      <button
        onClick={handleSelect}
        className='px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700'
        disabled={!selectedRepo}
      >
        🚀 Ingest Repo
      </button>
    </div>
  );
};

export default RepoSelector;
