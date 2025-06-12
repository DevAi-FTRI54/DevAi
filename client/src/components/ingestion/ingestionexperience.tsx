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

const IngestionExperience: React.FC<
  IngestionExperienceProps & { org?: string; installationId?: string | null }
> = ({ compact, org, installationId }) => {
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
      <div className='bg-[#303030] rounded-lg p-2.5 border border-[#404040]'>
        <div className='flex items-center gap-2 mb-2'>
          <div className='w-3 h-3 bg-green-500 rounded-full flex items-center justify-center'>
            <svg
              className='w-2 h-2 text-white'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                clipRule='evenodd'
              />
            </svg>
          </div>
          <span className='text-green-400 font-medium text-xs'>
            Ingestion Complete!
          </span>
        </div>
        <button
          className='w-full px-2 py-1.5 bg-[#5ea9ea] hover:bg-[#4a9ae0] text-white rounded-lg text-xs font-medium transition-colors duration-200'
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
        navigate('/chat', {
          state: {
            repo: selectedRepo,
            org: selectedOrg,
            installationId: selectedInstallationId,
          },
        });
      }}
    />
  );
};

export default IngestionExperience;
