import React from 'react';
import { useNavigate } from 'react-router-dom';
import IngestionExperience from './ingestionexperience';

const IngestionFlow: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="text-gray min-h-screen">
      <IngestionExperience onComplete={(repo) => navigate('/chat', { state: { repo } })} />
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
//         // <ProgressBar
//         //   jobId={jobId}
//         //   onComplete={() => {
//         //     // Add repo id or other info as a query param if needed
//         //     const repoParam = selectedRepo ? `?repoId=${selectedRepo.id}` : '';
//         //     window.location.href = `https://a59d8fd60bb0.ngrok.app/chat${repoParam}`;
//         //   }}
//         // />
//       )}
//     </div>
//   );
// };

// export default IngestionFlow;
