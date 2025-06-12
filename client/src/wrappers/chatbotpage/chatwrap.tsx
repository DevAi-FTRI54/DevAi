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

  // Show streaming state while waiting for/receiving AI response
  const streamingComponent = useMemo(() => {
    // Show nothing if not loading or streaming
    if (!isLoadingResponse && !isStreaming) return null;

    return (
      <div className='mb-8'>
        <div className='flex justify-start'>
          <div className='max-w-[85%] bg-[#212121] border border-[#303030]/50 rounded-3xl rounded-bl-lg px-6 py-4 shadow-sm'>
            <div className='flex items-center gap-2 mb-4'>
              <div className='w-6 h-6 bg-gradient-to-br from-[#5ea9ea] to-[#4a9ae0] rounded-full flex items-center justify-center flex-shrink-0'>
                <svg
                  className='w-3.5 h-3.5 text-white'
                  fill='currentColor'
                  viewBox='0 0 20 20'
                >
                  <path
                    fillRule='evenodd'
                    d='M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <div className='flex items-center gap-2'>
                <div className='flex gap-1'>
                  <div className='w-1.5 h-1.5 bg-[#5ea9ea] rounded-full animate-bounce'></div>
                  <div
                    className='w-1.5 h-1.5 bg-[#5ea9ea] rounded-full animate-bounce'
                    style={{ animationDelay: '0.1s' }}
                  ></div>
                  <div
                    className='w-1.5 h-1.5 bg-[#5ea9ea] rounded-full animate-bounce'
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                </div>
                <span className='text-[#5ea9ea] text-sm font-medium'>
                  {isLoadingResponse ? 'Thinking...' : 'Responding...'}
                </span>
              </div>
            </div>
            {/* Only show streaming text when actually streaming */}
            {isStreaming && streamingAnswer && (
              <div className='text-[#fafafa] leading-relaxed whitespace-pre-wrap'>
                {streamingAnswer}
                <span className='inline-block w-0.5 h-5 bg-[#5ea9ea] animate-pulse ml-1 rounded-sm'></span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }, [isLoadingResponse, isStreaming, streamingAnswer]);

  if (!githubToken) {
    return (
      <div className='min-h-screen bg-[#171717] flex items-center justify-center'>
        <div className='bg-[#212121] border border-[#303030] rounded-2xl shadow-lg p-8 max-w-md mx-auto text-center'>
          <div className='w-12 h-12 bg-gradient-to-br from-[#5ea9ea] to-[#4a9ae0] rounded-xl flex items-center justify-center mx-auto mb-4'>
            <svg
              className='w-6 h-6 text-white animate-spin'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z'
                clipRule='evenodd'
              />
            </svg>
          </div>
          <h2 className='text-lg font-semibold text-[#fafafa] mb-2'>
            Loading GitHub Token
          </h2>
          <p className='text-[#888] text-sm'>
            Please wait while we retrieve your authentication token...
          </p>
        </div>
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
    <div className='flex h-screen bg-[#171717] antialiased'>
      {/* Sidebar */}
      <div className='h-full flex flex-col flex-[1_1_20%] min-w-[280px] max-w-[400px] bg-[#212121] border-r border-[#303030]/50'>
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
      <div className='flex-1 flex flex-col h-full bg-[#171717]'>
        <div className='flex flex-col w-full h-full max-w-4xl mx-auto'>
          {/* Chat Header */}
          <div className='flex-shrink-0 px-6 py-4 border-b border-[#303030]/30'>
            <div className='flex items-center gap-3'>
              <div className='w-8 h-8 bg-gradient-to-br from-[#5ea9ea] to-[#4a9ae0] rounded-lg flex items-center justify-center'>
                <svg
                  className='w-5 h-5 text-white'
                  fill='currentColor'
                  viewBox='0 0 20 20'
                >
                  <path
                    fillRule='evenodd'
                    d='M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <div>
                <h1 className='text-lg font-semibold text-[#fafafa]'>
                  {repoName}
                </h1>
                <p className='text-sm text-[#888] leading-none'>
                  {owner}/{repoName}
                </p>
              </div>
            </div>
          </div>

          {/* Messages Container */}
          <div className='flex-1 overflow-y-auto min-h-0 px-6 py-4'>
            <div className='max-w-3xl mx-auto'>
              {messages.length === 0 && (
                <div className='flex flex-col items-center justify-center h-96 text-center'>
                  <div className='w-16 h-16 bg-gradient-to-br from-[#5ea9ea] to-[#4a9ae0] rounded-2xl flex items-center justify-center mb-6'>
                    <svg
                      className='w-8 h-8 text-white'
                      fill='currentColor'
                      viewBox='0 0 20 20'
                    >
                      <path
                        fillRule='evenodd'
                        d='M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z'
                        clipRule='evenodd'
                      />
                    </svg>
                  </div>
                  <h2 className='text-xl font-semibold text-[#fafafa] mb-2'>
                    Welcome to DevAI
                  </h2>
                  <p className='text-[#888] max-w-md'>
                    Start a conversation about your codebase. Ask questions,
                    explore patterns, or get explanations about your code.
                  </p>
                </div>
              )}

              <ChatWindow messages={messages} onSelectFile={handleFileSelect} />
              {streamingComponent}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className='flex-shrink-0 border-t border-[#303030]/30 bg-[#171717]'>
            <div className='max-w-3xl mx-auto px-6 py-4'>
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
      </div>

      {/* File Viewer */}
      <div className='w-2/5 h-full bg-[#212121] border-l border-[#303030]/50 flex flex-col'>
        {/* File Viewer Header */}
        <div className='flex-shrink-0 px-6 py-4 border-b border-[#303030]/30'>
          <h3 className='text-sm font-medium text-[#fafafa] flex items-center gap-2'>
            <svg
              className='w-4 h-4 text-[#5ea9ea]'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path d='M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z' />
            </svg>
            File Preview
          </h3>
        </div>

        {/* File Content */}
        <div className='flex-1 overflow-y-auto min-h-0 p-6'>
          {originalFilePath ? (
            <RepoViewer
              repoUrl={`${owner}/${repoName}`}
              selectedPath={originalFilePath}
              setSelectedPath={setOriginalFilePath}
              token={githubToken!}
            />
          ) : (
            <div className='flex flex-col items-center justify-center h-64 text-center'>
              <div className='w-12 h-12 bg-[#303030] rounded-lg flex items-center justify-center mb-4'>
                <svg
                  className='w-6 h-6 text-[#888]'
                  fill='currentColor'
                  viewBox='0 0 20 20'
                >
                  <path d='M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z' />
                </svg>
              </div>
              <p className='text-[#888] text-sm'>
                Select a file to view its contents
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatWrap;
