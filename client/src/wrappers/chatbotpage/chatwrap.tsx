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
    <div className="flex h-[calc(100vh-56px)] bg-[#121629]">
      {/* Sidebar */}
      <div className="w-1/5 h-full bg-[#232946] border-r border-[#39415a] overflow-y-auto min-h-0">
        <PermanentSidebar owner={owner} repo={repo} onFileSelect={handleFileSelect} />
      </div>

      {/* Chat Area */}
      <div className="w-2/5 flex flex-col h-full px-6 py-8 min-h-0">
        {/* <div className="text-center mb-4 shrink-0">
          <h1 className="text-2xl font-bold text-[#5EEAD4]">DevAi Onboarding Assistant</h1>
          <p className="text-sm text-gray-400">Ask anything about this codebase during your onboarding</p>
        </div> */}
        {/* ChatWindow scrolls independently */}
        <div className="w-full max-w-2xl flex-1 flex flex-col gap-2 overflow-y-auto min-h-0">
          <ChatWindow messages={messages} />
        </div>
        <div className="w-full max-w-2xl shrink-0">
          <ChatInput setAnswer={handleSetAnswer} />
        </div>
      </div>

      {/* File Viewer */}
      <div className="w-2/5 h-full overflow-y-auto bg-[#232946] border-l border-[#39415a] p-6 min-h-0">
        {selectedFilePath ? (
          <RepoViewer repoUrl={`${owner}/${repo}`} selectedPath={selectedFilePath} />
        ) : (
          <div className="text-gray-400 italic">Select a file to view its contents</div>
        )}
      </div>
    </div>
  );
};

export default ChatWrap;
