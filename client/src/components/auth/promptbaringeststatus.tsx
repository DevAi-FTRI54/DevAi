import React, { useEffect, useState } from 'react';

export interface IngestionStatusData {
  status: string | 'pending' | 'indexing' | 'completed' | 'failed';
  lastUpdated: string;
  progress: number;
  data: {
    repoUrl: string;
    sha: string;
  };
}

interface ProgressBarProps {
  jobId: string;
  onComplete: () => void;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ jobId, onComplete }) => {
  const [status, setStatus] = useState<IngestionStatusData | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const fetchStatus = async () => {
      const res = await fetch(`/api/index/status/${jobId}`);
      if (res.ok) {
        const data: IngestionStatusData = await res.json();
        setStatus(data);

        if (data.progress >= 100 || data.status === 'completed') {
          setTimeout(() => onComplete(), 400);
        }
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, [jobId, onComplete]);

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
      <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
        <div
          className="bg-blue-600 h-4 rounded-full transition-all duration-300"
          style={{ width: `${status.progress}%` }}
        />
      </div>
      <div className="mb-2">{status.progress}%</div>
      <p>
        <strong>RepoURL:</strong> {status.data.repoUrl}
      </p>
      <p className={getStatusColor(status.status)}>
        <strong>Status:</strong> {status.status.toUpperCase()}
      </p>
      {/* <p>
        <strong>Chunks:</strong> {status.chunkCount}
      </p> */}
    </div>
  );
};

export default ProgressBar;
