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

  if (!status) return <div className='p-4'>Loading ingestion status ...</div>;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'indexing':
        return 'text-[#5ea9ea]';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-yellow-400';
    }
  };

  return (
    <div className='min-h-screen bg-[#171717] flex items-center justify-center'>
      <div className='bg-[#212121] border border-[#303030] rounded-2xl shadow-lg p-8 max-w-md mx-auto'>
        <div className='flex items-center gap-3 mb-6'>
          <div className='w-8 h-8 bg-gradient-to-br from-[#5ea9ea] to-[#4a9ae0] rounded-lg flex items-center justify-center'>
            <svg
              className='w-5 h-5 text-white animate-pulse'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z'
                clipRule='evenodd'
              />
            </svg>
          </div>
          <div>
            <h2 className='text-lg font-semibold text-[#fafafa]'>
              Processing Repository
            </h2>
            <p className='text-sm text-[#888]'>
              Ingesting and indexing your codebase
            </p>
          </div>
        </div>

        <div className='space-y-4'>
          <div className='w-full bg-[#303030] rounded-full h-3 overflow-hidden'>
            <div
              className='bg-gradient-to-r from-[#5ea9ea] to-[#4a9ae0] h-3 rounded-full transition-all duration-500 ease-out'
              style={{ width: `${status.progress}%` }}
            />
          </div>

          <div className='flex justify-between items-center text-sm'>
            <span className='text-[#fafafa] font-medium'>
              {status.progress}%
            </span>
            <span className={`font-medium ${getStatusColor(status.status)}`}>
              {status.status.toUpperCase()}
            </span>
          </div>

          <div className='bg-[#303030]/30 rounded-lg p-3 border border-[#404040]'>
            <p className='text-xs text-[#888] mb-1'>Repository:</p>
            <p className='text-[#fafafa] text-sm font-mono break-all'>
              {status.data.repoUrl}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
