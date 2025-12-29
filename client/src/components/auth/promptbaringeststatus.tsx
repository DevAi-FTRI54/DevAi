import React, { useEffect, useState } from 'react';

export interface IngestionStatusData {
  status: string | 'pending' | 'indexing' | 'completed' | 'failed';
  lastUpdated: string;
  progress: number;
  data: {
    repoUrl: string;
    sha: string;
  };
  failedReason?: string | null; // Show error message when job fails
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
        
        // Log response to console so we can see errors in browser dev tools
        console.log('Job status response:', data);
        if (data.status === 'failed' && data.failedReason) {
          console.error('Job failed with error:', data.failedReason);
        }
        
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
      {/* Show error message if job failed */}
      {status.status === 'failed' && status.failedReason && (
        <div className="mt-2 p-2 bg-red-100 border border-red-400 rounded text-red-700 text-sm">
          <strong>Error:</strong> {status.failedReason}
        </div>
      )}
      {/* <p>
        <strong>Chunks:</strong> {status.chunkCount}
      </p> */}
    </div>
  );
};

export default ProgressBar;
