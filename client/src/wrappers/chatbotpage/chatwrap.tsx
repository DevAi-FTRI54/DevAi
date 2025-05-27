import React, { useState } from 'react';
import PermanentSidebar from '../../components/bars/FileTree/sidebarDrawer';
import ChatWindow from '../../components/chat/chatwindow';
import ChatInput from '../../components/chat/chatinput';
import RepoViewer from '../../components/chat/filepreview';
import type { Message } from '../../types';

const ChatWrap: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  const owner = 'Team-Taz-FTRI-54';
  const repo = 'AI-ML-Project';

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
      { role: 'user', content: userPrompt, snippet: '', file: '', startLine: 0, endLine: 0 },
      {
        role: 'assistant',
        content: answer,
        snippet: snippet ?? '',
        file: file,
        startLine: startLine,
        endLine: endLine,
      },
    ]);
  };

  const handleFileSelect = (filePath: string) => {
    setSelectedFilePath(filePath);
    // Optional: navigate(`/fileviewer?path=${encodeURIComponent(filePath)}`);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen pt-[64px] overflow-hidden ">
      {/* Sidebar - always visible on desktop, top on mobile */}
      <div className="w-full md:w-1/5 border-r border-gray-200">
        <PermanentSidebar owner={owner} repo={repo} onFileSelect={handleFileSelect} />
      </div>

      {/* Chat Area */}
      <div className="w-full md:w-2/5 flex flex-col items-center px-4 py-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">DevAi Onboarding Assistant</h1>
          <p className="text-sm text-gray-500">Ask anything about this codebase during your onboarding</p>
        </div>

        <div className="w-full max-w-2xl flex-1 flex flex-col gap-2">
          <ChatWindow messages={messages} />

          <ChatInput setAnswer={handleSetAnswer} />
        </div>
      </div>

      {/* File Viewer */}
      <div className="w-full md:w-2/5 border-l border-gray-200 p-4 overflow-y-auto">
        {selectedFilePath ? (
          <RepoViewer repoUrl={`${owner}/${repo}`} selectedPath={selectedFilePath} />
        ) : (
          <div className="text-gray-500 italic">Select a file to view its contents</div>
        )}
      </div>
    </div>
  );
};

export default ChatWrap;
