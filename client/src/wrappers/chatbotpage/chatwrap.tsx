import React, { useState, useEffect } from 'react';
import PermanentSidebar from '../../components/bars/FileTree/sidebarDrawer';
import ChatWindow from '../../components/chat/chatwindow';
import ChatInput from '../../components/chat/chatinput';
import RepoViewer from '../../components/chat/filepreview';
import type { Message, ChatWrapProps } from '../../types';

const ChatWrap: React.FC<ChatWrapProps> = ({ repo }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState<string | null>(null);

  // Extract owner and repoName from the repo full name
  const [owner, repoName] = repo.full_name.split('/');

  // Get GitHub token
  useEffect(() => {
    const getGithubToken = async () => {
      try {
        const response = await fetch('/api/auth/github-token', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setGithubToken(data.token);
        } else {
          console.error(
            'Failed to get token:',
            response.status,
            response.statusText
          );
        }
      } catch (error) {
        console.error('Failed to get GitHub token:', error);
      }
    };

    getGithubToken();
  }, []);

  if (!githubToken) {
    return (
      <div className='flex h-[calc(100vh-56px)] bg-[#121629] items-center justify-center'>
        <div className='text-white'>Loading GitHub token...</div>
      </div>
    );
  }

  const handleSetAnswer = (
    answer: string,
    userPrompt: string,
    snippet: string,
    file: string,
    startLine: number,
    endLine: number
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: userPrompt,
        snippet: '',
        file: '',
        startLine: 0,
        endLine: 0,
      },
      {
        role: 'assistant',
        content: answer,
        snippet: snippet || '',
        file: file,
        startLine: startLine,
        endLine: endLine,
      },
    ]);
  };

  const handleFileSelect = (filePath: string) => {
    setSelectedFilePath(filePath);
  };

  return (
    <div className='flex h-[calc(100vh-56px)] bg-[#121629]'>
      {/* Sidebar */}
      <div className='w-1/5 h-full bg-[#232946] border-r border-[#39415a] overflow-y-auto min-h-0'>
        <PermanentSidebar
          owner={owner}
          repo={repoName}
          repoData={repo}
          onFileSelect={handleFileSelect}
          token={githubToken!}
        />
      </div>

      {/* Chat Area */}
      <div className='w-2/5 flex flex-col h-full px-6 py-0 min-h-0 items-center'>
        {/* Centered wrapper, full height column */}
        <div className='flex flex-col items-center w-full h-full max-w-2xl mx-auto'>
          {/* Chat messages area: scrollable and grows */}
          <div className='flex-1 w-full overflow-y-auto min-h-0'>
            <ChatWindow messages={messages} />
          </div>
          {/* Chat input area: fixed at bottom */}
          <div className='w-full mt-4'>
            <ChatInput repoUrl={repo.html_url} setAnswer={handleSetAnswer} />
          </div>
        </div>
      </div>

      {/* File Viewer */}
      <div className='w-2/5 h-full overflow-y-auto bg-[#232946] border-l border-[#39415a] p-6 min-h-0'>
        {selectedFilePath ? (
          <RepoViewer
            repoUrl={`${owner}/${repoName}`}
            selectedPath={selectedFilePath}
          />
        ) : (
          <div className='text-gray-400 italic'>
            Select a file to view its contents
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWrap;
