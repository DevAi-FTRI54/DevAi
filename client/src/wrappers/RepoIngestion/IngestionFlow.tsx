import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RepoSelector from '../../components/auth/reposelector';
import ProgressBar from '../../components/auth/promptbaringeststatus';

const IngestionFlow: React.FC = () => {
  const [jobId, setJobId] = useState<string | null>(null);
  const navigate = useNavigate();

  return (
    <>
      {!jobId ? (
        <RepoSelector onStartIngestion={setJobId} />
      ) : (
        <ProgressBar jobId={jobId} onComplete={() => navigate('/chat')} />
      )}
    </>
  );
};

export default IngestionFlow;
