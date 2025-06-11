import React, { createContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { IngestionContextType, Repo } from '../../types'; // adjust path as needed

const IngestionContext = createContext<IngestionContextType | undefined>(undefined);

interface IngestionProviderProps {
  children: ReactNode;
}

export const IngestionProvider: React.FC<IngestionProviderProps> = ({ children }) => {
  const [jobId, setJobId] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [installationId, setInstallationId] = useState<string | null>(null);

  const handleStartIngestion = (jobId: string, repo: Repo) => {
    setJobId(jobId);
    setSelectedRepo(repo);
  };

  return (
    <IngestionContext.Provider
      value={{
        jobId,
        selectedRepo,
        selectedOrg,
        installationId,
        handleStartIngestion,
        setJobId,
        setSelectedRepo,
        setSelectedOrg,
        setInstallationId,
      }}
    >
      {children}
    </IngestionContext.Provider>
  );
};

export { IngestionContext };
export default IngestionProvider;
