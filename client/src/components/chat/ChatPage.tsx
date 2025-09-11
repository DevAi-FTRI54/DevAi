import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ChatWrap from '../../wrappers/chatbotpage/chatwrap';
import type { Repo } from '../../types';

const REPO_KEY = 'devai_repo';

const ChatPage: React.FC = () => {
  const location = useLocation();
  const [repo, setRepo] = useState<Repo | null>(null);
  const [org, setOrg] = useState<string | null>(null);
  const [installationId, setInstallationId] = useState<string | null>(null);

  useEffect(() => {
    // Try to get from router state first
    const repoFromState = location.state?.repo;
    const orgFromState = location.state?.org;
    if (repoFromState) {
      setRepo(repoFromState);
      localStorage.setItem(REPO_KEY, JSON.stringify(repoFromState));

      // LOG EVERYTHING!
      console.log('repoFromState:', repoFromState);
      console.log('All keys:', Object.keys(repoFromState));
      // Try every reasonable way to get org/installationId
      // Prefer org from state if available, then fallback to extraction
      setOrg(orgFromState || repoFromState.org || repoFromState.owner?.login || repoFromState.organization || null);
      setInstallationId(
        repoFromState.installationId ||
          repoFromState.installation_id ||
          repoFromState.installationID ||
          repoFromState.installation ||
          null
      );
    } else {
      // Otherwise, try from localStorage
      const repoFromStorage = localStorage.getItem(REPO_KEY);
      if (repoFromStorage) {
        try {
          const parsedRepo = JSON.parse(repoFromStorage);
          setRepo(parsedRepo);
          // LOG EVERYTHING!
          console.log('parsedRepo:', parsedRepo);
          console.log('All keys:', Object.keys(parsedRepo));
          setOrg(parsedRepo.org || parsedRepo.owner?.login || parsedRepo.organization || null);
          setInstallationId(
            parsedRepo.installationId ||
              parsedRepo.installation_id ||
              parsedRepo.installationID ||
              parsedRepo.installation ||
              null
          );
        } catch {
          setRepo(null);
        }
      }
    }
  }, [location.state]);

  if (!repo) {
    return (
      <div className="min-h-screen bg-[#23262f] flex items-center justify-center">
        <div className="text-white text-xl">No repository selected</div>
      </div>
    );
  }

  // Pass org/installationId as needed to children/components, like:
  return (
    <ChatWrap
      repo={{
        ...repo,
        org: org ?? '',
        installationId: installationId ?? null,
      }}
      org={org ?? undefined}
      installationId={installationId}
    />
  );
};

export default ChatPage;
