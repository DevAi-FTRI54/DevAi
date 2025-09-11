import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import GitHubAppInstallButton from './githubappinstallbutton'; // Adjust path as needed

const InstallAppPrompt: React.FC = () => {
  return (
    <div className='min-h-screen bg-[#171717] flex flex-col items-center justify-center'>
      <div className='bg-[#212121] border border-[#303030] rounded-2xl shadow-lg p-8 max-w-md mx-auto text-center'>
        <div className='w-16 h-16 bg-gradient-to-br from-[#5ea9ea] to-[#4a9ae0] rounded-2xl flex items-center justify-center mx-auto mb-6'>
          <FontAwesomeIcon icon={faGithub} className='text-white text-2xl' />
        </div>

        <h1 className='text-xl font-semibold text-[#fafafa] mb-2 flex items-center justify-center gap-2'>
          Install DevAI GitHub App
        </h1>
        <p className='text-[#888] text-sm mb-6 max-w-sm'>
          To index your repositories and power AI features, please install the
          DevAI GitHub App on your repositories.
        </p>

        <GitHubAppInstallButton />
      </div>
    </div>
  );
};

export default InstallAppPrompt;
