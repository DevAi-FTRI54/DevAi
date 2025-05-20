import React, { useEffect, useState } from 'react';

//* define component & set state for repo & which one is selected
const RepoSelector: React.FC = () => {
  const [repos, setRepos] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>('');

  //* useEffect runs once on component mount to fetch the list of available repositories
  useEffect(() => {
    const fetchRepos = async () => {
      const res = await fetch(import.meta.env.VITE_GITHUB_REPOS);
      const data = await res.json();
      setRepos(data); // used to save the fetched repos to state
    };
    fetchRepos();
  }, []);

  //* Sends a POST request to the backend to start indexing the selected repository
  const handleSelect = async () => {
    try {
      const res = await fetch('import.meta.env.VITE_GITHUB_INDEX', {
        // <-- Replace with actual endpoint like /api/github/index
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: selected }),
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
        {repos.map((repo) => (
          <option key={repo} value={repo}>
            {repo}
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
