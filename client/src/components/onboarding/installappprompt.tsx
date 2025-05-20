import React from 'react';

const InstallAppPrompt: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-semibold mb-4">Install DevAI GitHub App</h1>
      <p className="mb-6 max-w-md text-center">
        To index your repositories and power AI features, please install the DevAI GitHub App on your repositories.
      </p>
      <a
        href="https://github.com/apps/devai-repo-agent/installations/new"
        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        ➕ Install GitHub App
      </a>
    </div>
  );
};

export default InstallAppPrompt;
