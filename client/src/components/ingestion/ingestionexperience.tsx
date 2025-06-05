import React, { useState } from 'react';
import RepoSelector from '../auth/reposelector';
import ProgressBar from '../../components/auth/promptbaringeststatus';
import type { Repo } from '../../types';

interface IngestionExperienceProps {
  compact?: boolean;
}

const IngestionExperience: React.FC<IngestionExperienceProps> = ({ compact }) => {
  const [jobId, setJobId] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [completed, setCompleted] = useState(false);

  const handleStartIngestion = (jobId: string, repo: Repo) => {
    setJobId(jobId);
    setSelectedRepo(repo);
    setCompleted(false);
  };

  if (completed) {
    return (
      <div className="flex flex-col items-start">
        <div className="mb-2 text-green-500 font-semibold text-xs">Ingestion complete!</div>
        <button
          className="mt-1 px-2 py-1 bg-blue-600 text-white rounded text-xs"
          onClick={() => {
            setJobId(null);
            setSelectedRepo(null);
            setCompleted(false);
          }}
        >
          Ingest Another Repository
        </button>
      </div>
    );
  }

  if (!jobId) {
    return <RepoSelector onStartIngestion={handleStartIngestion} compact={compact} />;
  }

  return <ProgressBar jobId={jobId} onComplete={() => setCompleted(true)} />;
};

export default IngestionExperience;
