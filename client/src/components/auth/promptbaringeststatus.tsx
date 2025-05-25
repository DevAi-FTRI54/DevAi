//used to see hwo far we are on the ingestion => will get percentage from the backend
import React, { useEffect, useState } from 'react';

interface IngestionStatusData {
  repoName: string;
  status: 'pending' | 'indexing' | 'completed' | 'failed';
  chunkCount: number;
  lastUpdated: string; //ISO timestamp
}

const ProgressBar: React.FC = () => {
  const [status, setStatus] = useState<IngestionStatusData | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      const res = await fetch('http://localhost:4000/api/github/ingestion-status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    };
    fetchStatus();

    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!status) return <div className="p-4">Loading ingestion status ...</div>;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'indexing':
        return 'text-blue-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  return (
    <div className="p-4 border rounded shadow max-w-lg mx-auto mt-4">
      <h2 className="text-lg font-semibold mb-2">Progress Status</h2>
      <p>
        <strong>Repo:</strong>
        {status.repoName}
      </p>
      <p className={getStatusColor(status.status)}>
        <strong>Status:</strong> {status.status.toUpperCase()}
      </p>
      <p>
        <strong>Chunks:</strong>
        {status.chunkCount}
      </p>
      <p>
        <strong>Last Updated:</strong>
        {new Date(status.lastUpdated).toLocaleString()}
      </p>
    </div>
  );
};

export default ProgressBar;
