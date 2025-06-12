import React from 'react';
// import { useNavigate } from 'react-router-dom';
import IngestionExperience from './ingestionexperience';

const IngestionFlow: React.FC = () => {
  // const navigate = useNavigate();

  return (
    <div className='min-h-screen bg-[#171717]'>
      <IngestionExperience />
    </div>
  );
};

export default IngestionFlow;

// import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import RepoSelector from '../../components/auth/reposelector';
// import ProgressBar from '../../components/auth/promptbaringeststatus';
// import type { Repo } from '../../types';

// const IngestionFlow: React.FC = () => {
//   const [jobId, setJobId] = useState<string | null>(null);
//   const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
//   const navigate = useNavigate();

//   const handleStartIngestion = (jobId: string, repo: Repo) => {
//     setJobId(jobId);
//     setSelectedRepo(repo);
//   };

//   return (
//     <div className=" text-gray min-h-screen">
//       {!jobId ? (
//         <RepoSelector onStartIngestion={handleStartIngestion} />
//       ) : (
//         <ProgressBar jobId={jobId} onComplete={() => navigate('/chat', { state: { repo: selectedRepo } })} />
//       )}
//     </div>
//   );
// };

// export default IngestionFlow;
