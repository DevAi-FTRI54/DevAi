import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import GitHubAppInstallButton from './githubappinstallbutton/githubappinstallbutton'; // Adjust path as needed

const InstallAppPrompt: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-semibold mb-4 flex items-center gap-2">
        <FontAwesomeIcon icon={faGithub} />
        Install DevAI GitHub App
      </h1>
      <p className="mb-6 max-w-md text-center">
        To index your repositories and power AI features, please install the DevAI GitHub App on your repositories.
      </p>
      <GitHubAppInstallButton />
    </div>
  );
};

export default InstallAppPrompt;
