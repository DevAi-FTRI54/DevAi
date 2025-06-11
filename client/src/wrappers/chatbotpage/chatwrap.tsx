import React, { useState, useEffect, useMemo, useRef } from 'react';
import PermanentSidebar from '../../components/bars/FileTree/sidebarDrawer';
import ChatWindow from '../../components/chat/chatwindow';
import ChatInput from '../../components/chat/chatinput';
import RepoViewer from '../../components/chat/filepreview';
import type { Message, ChatWrapProps } from '../../types';

// // Helper to convert absolute to repo-relative path
// function toRepoRelative(absolutePath: string) {
//   const match = absolutePath.match(/AI_ML_Project\/[^/]+\/(.+)/);
//   return match ? match[1] : absolutePath;
// }

const ChatWrap: React.FC<ChatWrapProps> = ({ repo, org, installationId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  // const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [originalFilePath, setOriginalFilePath] = useState<string>('');
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);

  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Extract owner and repoName from the repo full name
  const [owner, repoName] = repo.full_name.split('/');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('🎯 ChatWrap state:', {
      isStreaming,
      streamingAnswerLength: streamingAnswer.length,
    });
  }, [isStreaming, streamingAnswer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingAnswer]);

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
          console.error('Failed to get token:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Failed to get GitHub token:', error);
      }
    };

    getGithubToken();
  }, []);

  // Show streaming state while waiting for/receiving AI response
  const streamingComponent = useMemo(() => {
    // Show nothing if not loading or streaming
    if (!isLoadingResponse && !isStreaming) return null;

    return (
      <div className="mb-6">
        <div className="flex justify-start mb-4">
          <div className="max-w-[90%] bg-[#181A2B] border border-[#39415a] p-4 rounded-2xl rounded-bl-md">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-[#5ea9ea] rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-[#5ea9ea] rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                ></div>
                <div
                  className="w-2 h-2 bg-[#5ea9ea] rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                ></div>
              </div>
              {/* ✅ Different messages for different states */}
              <span className="text-[#5ea9ea] text-xs font-medium">
                {isLoadingResponse ? 'AI is thinking...' : 'AI is responding...'}
              </span>
            </div>
            {/* Only show streaming text when actually streaming */}
            {isStreaming && streamingAnswer && (
              <div className="text-[#eaeaea] text-sm leading-relaxed whitespace-pre-wrap">
                {streamingAnswer}
                <span className="inline-block w-2 h-5 bg-[#5ea9ea] animate-pulse ml-1"></span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }, [isLoadingResponse, isStreaming, streamingAnswer]);

  if (!githubToken) {
    return (
      <div className="flex h-screen bg-[#121629] items-center justify-center">
        <div className="text-white">Loading GitHub token...</div>
      </div>
    );
  }

  // Add user's message to message list
  const handleAddUserMessage = (userPrompt: string) => {
    setMessages((prev) => [
      ...prev,
      {
        role: 'user' as const,
        content: userPrompt,
        snippet: '',
        file: '',
        startLine: 0,
        endLine: 0,
      },
    ]);
  };

  // Add AI's answer to message list
  const handleSetAnswer = (
    answer: string,
    // userPrompt: string,
    snippet: string,
    file: string,
    startLine: number,
    endLine: number
  ) => {
    console.log('💾 Storing message with file:', file);
    console.log('💾 File type:', typeof file);
    console.log('💾 File length:', file?.length);
    // Convert the file path to repo-relative before storing
    // const relativeFile = file ? toRepoRelative(file) : '';
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant' as const,
        content: answer,
        snippet: snippet || '',
        // file: relativeFile,
        file: file,
        startLine: startLine,
        endLine: endLine,
      },
    ]);
  };

  // Handle file click from sidebar or chat message
  const handleFileSelect = (filePath: string) => {
    console.log('📁 Original file path from selection:', filePath);

    setOriginalFilePath(filePath);
    // setSelectedFilePath(filePath);
  };

  // Always pass repo-relative paths to the chat window
  // const fixedMessages = messages.map((msg) =>
  //   msg && typeof msg === 'object' ? { ...msg, file: msg.file ?? '' } : msg
  // );

  return (
    <div className="flex h-screen bg-[#212121]">
      {/* Sidebar */}
      <div className="h-full flex flex-col flex-[1_1_20%] min-w-[150px] max-w-[400px] bg-[#23272F] border-r border-[#2D2D37]">
        {/* Pass org/installId as needed */}
        {/* 
          The PermanentSidebar component should itself use a flex column layout, with:
          - header/top area (e.g. repo selector/ingestion)
          - scrollable content area for file tree (flex-1 overflow-y-auto)
        */}
        <PermanentSidebar
          owner={owner}
          repo={repoName}
          token={githubToken!}
          onFileSelect={handleFileSelect}
          org={org || repo.org}
          installationId={installationId || repo.installationId}
        />
      </div>

      {/* Chat Area */}
      <div className="w-2/5 flex flex-col h-full items-center">
        <div className="flex flex-col items-center w-full h-full max-w-2xl mx-auto">
          {/* Message list */}
          <div className="flex-1 w-full overflow-y-auto min-h-0 p-4">
            <ChatWindow messages={messages} onSelectFile={handleFileSelect} />
            {streamingComponent}
            <div ref={messagesEndRef} />
          </div>
          {/* Input */}
          <div className="w-full">
            <ChatInput
              repoUrl={repo.html_url}
              setAnswer={handleSetAnswer}
              addUserMessage={handleAddUserMessage}
              setStreamingAnswer={setStreamingAnswer}
              setIsStreaming={setIsStreaming}
              setIsLoadingResponse={setIsLoadingResponse}
            />
          </div>
        </div>
      </div>

      {/* File Viewer */}
      <div className="w-2/5 h-full overflow-y-auto bg-[#23272F] border-l border-[#2D2D37] p-6 min-h-0">
        {/* Show file preview if selected, else placeholder */}
        {originalFilePath ? (
          <RepoViewer
            repoUrl={`${owner}/${repoName}`}
            selectedPath={originalFilePath}
            setSelectedPath={setOriginalFilePath}
            token={githubToken!}
          />
        ) : (
          <div className="text-gray-400 italic">Select a file to view its contents</div>
        )}
      </div>
    </div>
  );
};

export default ChatWrap;
