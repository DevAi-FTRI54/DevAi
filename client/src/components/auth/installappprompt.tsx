import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import GitHubAppInstallButton from './githubappinstallbutton'; // Adjust path as needed

const InstallAppPrompt: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#23262f]">
      <h1 className="font-tt-hoves text-2xl font-semibold mb-4 flex items-center gap-2  text-white ">
        <FontAwesomeIcon icon={faGithub} />
        Install DevAi GitHub App
      </h1>
      <p className="font-tt-hoves mb-6 max-w-md text-center  text-white ">
        To index your repositories and power AI features, please install the DevAI GitHub App on your repositories.
      </p>
      <GitHubAppInstallButton />
    </div>
  );
};

export default InstallAppPrompt;
