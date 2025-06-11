import React, { useState, useContext, useEffect } from 'react';
import RepoSelector from '../auth/reposelector';
import ProgressBar from '../../components/auth/promptbaringeststatus';
import { useNavigate } from 'react-router-dom';
import type { Repo } from '../../types';
import { IngestionContext } from '../../components/ingestion/ingestioncontext';
import type { IngestionContextType } from '../../types';

interface IngestionExperienceProps {
  compact?: boolean;
}

const IngestionExperience: React.FC<IngestionExperienceProps & { org?: string; installationId?: string | null }> = ({
  compact,
  org,
  installationId,
}) => {
  const [jobId, setJobId] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [completed, setCompleted] = useState(false);
  const navigate = useNavigate();

  // Use context for org and installationId
  const context = useContext(IngestionContext) as IngestionContextType;

  // Update context when we receive org/installationId props
  useEffect(() => {
    if (org && context) {
      context.setSelectedOrg(org);
    }
    if (installationId && context) {
      context.setInstallationId(installationId);
    }
  }, [org, installationId, context]);

  // Always use context after it's been updated
  const selectedOrg = context.selectedOrg || org;
  const selectedInstallationId = context.installationId || installationId;

  console.log('--- ingestionexperience.tsx ---------');
  console.log(compact);
  console.log(selectedOrg);
  console.log(selectedInstallationId);

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
    // Pass org and installationId from context to RepoSelector
    return (
      <RepoSelector
        onStartIngestion={handleStartIngestion}
        compact={compact}
        org={selectedOrg}
        installationId={selectedInstallationId}
      />
    );
  }

  // FIXED: added return here!
  return (
    <ProgressBar
      jobId={jobId}
      onComplete={() => {
        setCompleted(true);
        navigate('/chat', { state: { repo: selectedRepo, org: selectedOrg, installationId: selectedInstallationId } });
      }}
    />
  );
};

export default IngestionExperience;
