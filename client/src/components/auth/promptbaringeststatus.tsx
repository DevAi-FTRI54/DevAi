import React, { useEffect, useState } from 'react';
import { getIngestionStatus } from '../../api'; // adjust path if needed

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
      try {
        const data = await getIngestionStatus(jobId);
        setStatus(data);

        if (data.progress >= 100 || data.status === 'completed') {
          setTimeout(() => onComplete(), 400);
        }
      } catch (err) {
        // Optionally show an error in the UI
        console.error('Error Found', err);
        setStatus(null);
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
    <div className="w-screen h-screen dark:bg-gray-900 bg-white">
      <div className="p-4 border rounded shadow max-w-lg mx-auto mt-4 bg-white dark:bg-gray-600 border-gray-400 dark:border-gray-800">
        <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Progress Status</h2>
        <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-4 mb-4">
          <div
            className="bg-blue-600 h-4 rounded-full transition-all duration-300"
            style={{ width: `${status.progress}%` }}
          />
        </div>
        <div className="mb-2 text-gray-900 dark:text-gray-100">{status.progress}%</div>
        <p className="text-gray-900 dark:text-gray-100">
          <strong>RepoURL:</strong> {status.data.repoUrl}
        </p>
        <p className={getStatusColor(status.status) + ' dark:text-gray-200'}>
          <strong>Status:</strong> {status.status.toUpperCase()}
        </p>
        {/* <p>
      <strong>Chunks:</strong> {status.chunkCount}
    </p> */}
      </div>
    </div>
  );
};

export default ProgressBar;

// import React, { useEffect, useState } from 'react';

// export interface IngestionStatusData {
//   status: string | 'pending' | 'indexing' | 'completed' | 'failed';
//   lastUpdated: string;
//   progress: number;
//   data: {
//     repoUrl: string;
//     sha: string;
//   };
// }

// interface ProgressBarProps {
//   jobId: string;
//   onComplete: () => void;
// }

// const ProgressBar: React.FC<ProgressBarProps> = ({ jobId, onComplete }) => {
//   const [status, setStatus] = useState<IngestionStatusData | null>(null);

//   useEffect(() => {
//     if (!jobId) return;

//     const fetchStatus = async () => {
//       const res = await fetch(`/api/index/status/${jobId}`);
//       if (res.ok) {
//         const data: IngestionStatusData = await res.json();
//         setStatus(data);

//         if (data.progress >= 100 || data.status === 'completed') {
//           setTimeout(() => onComplete(), 400);
//         }
//       }
//     };

//     fetchStatus();
//     const interval = setInterval(fetchStatus, 1000);
//     return () => clearInterval(interval);
//   }, [jobId, onComplete]);

//   if (!status) return <div className="p-4">Loading ingestion status ...</div>;

//   const getStatusColor = (status: string) => {
//     switch (status) {
//       case 'completed':
//         return 'text-green-600';
//       case 'indexing':
//         return 'text-blue-600';
//       case 'failed':
//         return 'text-red-600';
//       default:
//         return 'text-yellow-600';
//     }
//   };

//   return (
//     <div className="w-screen h-screen dark:bg-gray-900 bg-white">
//       <div className="p-4 border rounded shadow max-w-lg mx-auto mt-4 bg-white dark:bg-gray-600 border-gray-400 dark:border-gray-800">
//         <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Progress Status</h2>
//         <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-4 mb-4">
//           <div
//             className="bg-blue-600 h-4 rounded-full transition-all duration-300"
//             style={{ width: `${status.progress}%` }}
//           />
//         </div>
//         <div className="mb-2 text-gray-900 dark:text-gray-100">{status.progress}%</div>
//         <p className="text-gray-900 dark:text-gray-100">
//           <strong>RepoURL:</strong> {status.data.repoUrl}
//         </p>
//         <p className={getStatusColor(status.status) + ' dark:text-gray-200'}>
//           <strong>Status:</strong> {status.status.toUpperCase()}
//         </p>
//         {/* <p>
//       <strong>Chunks:</strong> {status.chunkCount}
//     </p> */}
//       </div>
//     </div>
//   );
// };

// export default ProgressBar;
