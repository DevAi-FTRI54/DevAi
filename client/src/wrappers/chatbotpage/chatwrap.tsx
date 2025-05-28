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
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] mt-[64px] overflow-hidden bg-gray-300">
      {/* Sidebar */}
      <div className="w-full md:w-1/5 h-full">
        <PermanentSidebar owner={owner} repo={repo} onFileSelect={handleFileSelect} />
      </div>

      {/* Chat Area */}
      <div className="w-full md:w-2/5 flex flex-col px-4 py-6 overflow-hidden h-full">
        <div className="text-center mb-4 shrink-0">
          <h1 className="text-2xl font-bold">DevAi Onboarding Assistant</h1>
          <p className="text-sm text-gray-500">Ask anything about this codebase during your onboarding</p>
        </div>

        <div className="w-full max-w-2xl flex-1 flex flex-col gap-2 overflow-y-auto">
          <ChatWindow messages={messages} />
        </div>

        <div className="w-full max-w-2xl shrink-0">
          <ChatInput setAnswer={handleSetAnswer} />
        </div>
      </div>

      {/* File Viewer */}
      <div className="w-full md:w-2/5 border-l border-gray-200 p-4 h-full overflow-y-auto">
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
