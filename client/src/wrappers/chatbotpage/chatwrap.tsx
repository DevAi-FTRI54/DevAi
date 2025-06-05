import React, { useState, useEffect, useMemo, useRef } from 'react';
import PermanentSidebar from '../../components/bars/FileTree/sidebarDrawer';
import ChatWindow from '../../components/chat/chatwindow';
import ChatInput from '../../components/chat/chatinput';
import RepoViewer from '../../components/chat/filepreview';
import type { Message, ChatWrapProps } from '../../types';

const ChatWrap: React.FC<ChatWrapProps> = ({ repo }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
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

  const streamingComponent = useMemo(() => {
    // Show nothing if not loading or streaming
    if (!isLoadingResponse && !isStreaming) return null;

    return (
      <div className='mb-6'>
        <div className='flex justify-start mb-4'>
          <div className='max-w-[90%] bg-[#181A2B] border border-[#39415a] p-4 rounded-2xl rounded-bl-md'>
            <div className='flex items-center gap-2 mb-3'>
              <div className='flex space-x-1'>
                <div className='w-2 h-2 bg-[#5ea9ea] rounded-full animate-bounce'></div>
                <div
                  className='w-2 h-2 bg-[#5ea9ea] rounded-full animate-bounce'
                  style={{ animationDelay: '0.1s' }}
                ></div>
                <div
                  className='w-2 h-2 bg-[#5ea9ea] rounded-full animate-bounce'
                  style={{ animationDelay: '0.2s' }}
                ></div>
              </div>
              {/* ✅ Different messages for different states */}
              <span className='text-[#5ea9ea] text-xs font-medium'>
                {isLoadingResponse
                  ? 'AI is thinking...'
                  : 'AI is responding...'}
              </span>
            </div>

            {/* Only show streaming text when actually streaming */}
            {isStreaming && streamingAnswer && (
              <div className='text-[#eaeaea] text-sm leading-relaxed whitespace-pre-wrap'>
                {streamingAnswer}
                <span className='inline-block w-2 h-5 bg-[#5ea9ea] animate-pulse ml-1'></span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }, [isLoadingResponse, isStreaming, streamingAnswer]);

  if (!githubToken) {
    return (
      <div className='flex h-[calc(100vh-56px)] bg-[#121629] items-center justify-center'>
        <div className='text-white'>Loading GitHub token...</div>
      </div>
    );
  }

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

  const handleSetAnswer = (
    answer: string,
    // userPrompt: string,
    snippet: string,
    file: string,
    startLine: number,
    endLine: number
  ) => {
    console.log('🎯 handleSetAnswer called:', {
      answer: answer.substring(0, 50) + '...',
      messagesBefore: messages.length,
    });

    console.log('handleSetAnswer file:', file);

    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant' as const,
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
      {/* <div className='w-1/5 h-full bg-[#232946] border-r border-[#39415a] overflow-y-auto min-h-0'> */}
      <div className='flex-[1_1_20%] min-w-[150px] max-w-[400px] bg-[#232946] border-r border-[#39415a] overflow-y-auto'>
        <PermanentSidebar
          owner={owner}
          repo={repoName}
          onFileSelect={handleFileSelect}
          token={githubToken!}
        />
      </div>

      {/* Chat Area */}
      <div className='w-2/5 flex flex-col h-full px-6 py-0 min-h-0 items-center'>
        {/* Centered wrapper, full height column */}
        <div className='flex flex-col items-center w-full h-full max-w-2xl mx-auto'>
          {/* Chat messages area: scrollable and grows */}
          <div className='flex-1 w-full overflow-y-auto min-h-0 p-4'>
            <ChatWindow messages={messages} onSelectFile={handleFileSelect} />
            {streamingComponent}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input area: fixed at bottom */}
          <div className='w-full mt-4'>
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
      <div className='w-2/5 h-full overflow-y-auto bg-[#232946] border-l border-[#39415a] p-6 min-h-0'>
        {selectedFilePath ? (
          <RepoViewer
            repoUrl={`${owner}/${repoName}`}
            selectedPath={selectedFilePath}
            token={githubToken!}
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
