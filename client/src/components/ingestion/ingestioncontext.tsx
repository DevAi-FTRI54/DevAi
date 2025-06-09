import React, { useState, createContext } from 'react';
import type { ReactNode } from 'react';
import type { Repo } from '../../types';

// TypeScript: Define the context value shape
type IngestionContextType = {
  jobId: string | null;
  selectedRepo: Repo | null;
  handleStartIngestion: (jobId: string, repo: Repo) => void;
  setJobId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedRepo: React.Dispatch<React.SetStateAction<Repo | null>>;
};

export const IngestionContext = createContext<IngestionContextType | undefined>(undefined);

interface IngestionProviderProps {
  children: ReactNode;
}

const IngestionProvider: React.FC<IngestionProviderProps> = ({ children }) => {
  // ---- THESE WERE MISSING: ----
  const [jobId, setJobId] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);

  const handleStartIngestion = (jobId: string, repo: Repo) => {
    setJobId(jobId);
    setSelectedRepo(repo);
  };

  return (
    <IngestionContext.Provider
      value={{
        jobId,
        selectedRepo,
        handleStartIngestion,
        setJobId,
        setSelectedRepo,
      }}
    >
      {children}
    </IngestionContext.Provider>
  );
};

export default IngestionProvider;
