import React, { useEffect, useState } from 'react';

// Helper: Parse query params (optional - you can use a library like 'query-string' if you prefer)
function getInstallationId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('installation_id') || '';
}

const RepoSelector: React.FC = () => {
  const [repos, setRepos] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [installationId, setInstallationId] = useState<string>('');

  // On mount, parse the installation_id from URL
  useEffect(() => {
    const id = getInstallationId();
    setInstallationId(id);
  }, []);

  // Fetch repos when installationId is set
  useEffect(() => {
    if (!installationId) return;
    const fetchRepos = async () => {
      try {
        const res = await fetch(`http://localhost:4000/api/github/repos?installation_id=${installationId}`);
        if (!res.ok) throw new Error('Failed to fetch repos');
        const data = await res.json();
        setRepos(data);
      } catch (err) {
        console.error('Error fetching repos:', err);
      }
    };
    fetchRepos();
  }, [installationId]);

  // Ingest selected repo
  const handleSelect = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/index/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: selected, installation_id: installationId }), // Send installation_id too!
      });

      if (!res.ok) {
        throw new Error(`Ingestion failed`);
      }

      alert(`🚀🚀 Started ingesting ${selected}`);
    } catch (error) {
      console.error('Error indexing repo:', error);
      alert(`Failed to start ingestion. Please try again.`);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Select a repository to index</h2>

      {/* Dropdown to select a repository */}
      <select className="w-full p-2 border rounded mb-4" value={selected} onChange={(e) => setSelected(e.target.value)}>
        <option value="">-- Choose a repo --</option>
        {repos.map((repUrl) => (
          <option key={repUrl} value={repUrl}>
            {repUrl}
          </option>
        ))}
      </select>

      {/* Button to trigger the ingestion */}
      <button
        onClick={handleSelect}
        className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        disabled={!selected}
      >
        🚀 Ingest Repo
      </button>
    </div>
  );
};

export default RepoSelector;
