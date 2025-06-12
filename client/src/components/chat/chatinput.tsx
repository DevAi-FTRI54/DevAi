import React, { useState, useEffect } from 'react';
import type { ChatInputProps } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';

type PromptType =
  | 'default'
  | 'Find'
  | 'Bugs'
  | 'Debug'
  | 'WalkThrough'
  | 'Services';

const QUICK_PROMPTS: Array<{ label: string; text: string; type: PromptType }> =
  [
    {
      label: 'Find & Explain',
      text: 'Find and explain the logic for the following: ',
      type: 'Find',
    },
    {
      label: 'Common Bugs',
      text: 'What are the most common bugs or pitfalls in this repo?',
      type: 'Bugs',
    },
    {
      label: 'Debug',
      text: 'Where do I start to debug this type of problem?',
      type: 'Debug',
    },
    {
      label: 'Walkthrough',
      text: 'Walk me through the data flow for ...',
      type: 'WalkThrough',
    },
    {
      label: 'Services',
      text: 'List all the third-party services used in this repo',
      type: 'Services',
    },
  ];

const autoGrow = (event: React.FormEvent<HTMLTextAreaElement>) => {
  const textarea = event.currentTarget;
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
};

const ChatInput: React.FC<ChatInputProps> = ({
  repoUrl,
  setAnswer,
  addUserMessage,
  setStreamingAnswer,
  setIsStreaming,
  setIsLoadingResponse,
}) => {
  const [promptText, setPromptText] = useState('');
  const [promptType, setPromptType] = useState<PromptType>('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const storedSessionID = localStorage.getItem('documentSessionId');

    if (storedSessionID) {
      console.log('📋 Found existing sessionId:', storedSessionID);
      setSessionId(storedSessionID);
    } else {
      const newSessionId = `session_${uuidv4()}`;
      console.log('🆕 Generated new sessionId:', newSessionId);

      localStorage.setItem('documentSessionId', newSessionId);
      setSessionId(newSessionId);
    }
  }, []);

  const handleQuickPrompt = (prompt: string, type: PromptType) => {
    setPromptText(prompt);
    setPromptType(type);
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPromptText(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const resetLoadingStates = () => {
    setIsStreaming?.(false);
    setStreamingAnswer?.('');
    setIsLoadingResponse?.(false);
    setLoading(false);
  };

  // Streaming: process the response live
  const processStreamingResponse = async (response: Response) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    // Switch from "thinking" to "streaming"
    setIsLoadingResponse?.(false);
    setIsStreaming?.(true);
    setStreamingAnswer?.('');

    let accumulatedAnswer = '';
    let finalCitations = [];

    while (true) {
      const { done, value } = (await reader?.read()) ?? {
        done: true,
        value: undefined,
      };
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        try {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            switch (data.type) {
              case 'status':
                console.log('Status:', data.message);
                break;

              case 'answer_chunk':
                accumulatedAnswer += data.content + ' ';
                setStreamingAnswer?.(accumulatedAnswer);
                break;

              case 'citations':
                finalCitations = data.data;
                break;

              case 'complete': {
                console.log('✅ Complete signal received');
                resetLoadingStates();

                const snippet = finalCitations?.[0]?.snippet ?? '';
                // const file = finalCitations?.[0]?.file?.split('/').pop() ?? '';
                const file = finalCitations?.[0]?.file ?? '';
                const startLine = finalCitations?.[0]?.startLine ?? 0;
                const endLine = finalCitations?.[0]?.endLine ?? 0;
                console.log('--- file ------------');
                console.log(file);

                setAnswer(
                  accumulatedAnswer.trim(),
                  snippet,
                  file,
                  startLine,
                  endLine
                );

                break;
              }

              case 'error':
                throw new Error(data.message);
            }
          }
        } catch (parseError) {
          console.error('❌ Parse error:', parseError);
          throw parseError;
        }
      }
    }
  };

  // Store user's message into our DB
  const storeUserMessage = async (userMessage: string) => {
    try {
      const response = await fetch('/api/query/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          // userId, // We must get this from somewhere
          role: 'user',
          content: userMessage,
          repoUrl,
          timestamp: new Date(),
        }),
      });

      if (!response.ok) throw new Error('Failed to store user message');
      return true;
    } catch (err) {
      console.error('❌ Failed to store user message:', err);
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!promptText.trim()) return;

    const userMessage = promptText;
    setPromptText('');
    setLoading(true);
    setError(null);

    try {
      await storeUserMessage(userMessage);

      console.log('🤔 AI is thinking...');
      addUserMessage?.(userMessage); // Add user message immediately
      setIsLoadingResponse?.(true); // Start "thinking" state

      console.log('🚀 Starting streaming...');
      setIsStreaming?.(true);
      setStreamingAnswer?.('');

      const response = await fetch('/api/query/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: repoUrl,
          prompt: userMessage,
          type: promptType,
          sessionId,
        }),
      });
      if (!response.ok) throw new Error('Failed to submit prompt');

      await processStreamingResponse(response);
    } catch (err) {
      console.error('❌ Submit error:', err);
      resetLoadingStates();
      if (err instanceof Error) setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='w-full'>
      {/* Quick Prompts */}
      <div className='mb-4'>
        <div className='flex flex-wrap gap-2 justify-center'>
          {QUICK_PROMPTS.map(({ label, text, type }) => (
            <button
              key={type}
              type='button'
              className='px-3 py-1.5 text-xs font-medium bg-[#303030] hover:bg-[#404040] text-[#fafafa] rounded-full border border-[#404040] hover:border-[#5ea9ea] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
              onClick={() => handleQuickPrompt(text, type)}
              disabled={loading}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className='relative bg-[#212121] border border-[#303030] rounded-2xl shadow-lg transition-all duration-200 focus-within:border-[#5ea9ea] focus-within:shadow-xl focus-within:shadow-[#5ea9ea]/10'>
        <textarea
          id='user-prompt'
          className='w-full min-h-[56px] max-h-32 resize-none text-[#fafafa] placeholder-[#888] p-4 pr-14 bg-transparent border-0 rounded-2xl focus:outline-none transition-all duration-200'
          placeholder='Ask about your codebase...'
          value={promptText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onInput={autoGrow}
          rows={1}
          disabled={loading}
        />
        <button
          type='button'
          className='absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#5ea9ea] hover:bg-[#4a9ae0] disabled:bg-[#404040] text-white rounded-lg flex items-center justify-center transition-all duration-200 disabled:cursor-not-allowed'
          onClick={handleSubmit}
          disabled={loading || !promptText.trim()}
        >
          {loading ? (
            <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
          ) : (
            <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 24 24'>
              <path
                d='M2.01 21L23 12 2.01 3 2 10l15 2-15 2z'
                strokeLinejoin='round'
                strokeLinecap='round'
              />
            </svg>
          )}
        </button>
      </div>

      {error && (
        <div className='mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg'>
          <p className='text-red-400 text-sm'>{error}</p>
        </div>
      )}

      <div className='mt-3 flex justify-center'>
        <button
          type='button'
          className='px-4 py-2 text-sm font-medium bg-[#303030] hover:bg-[#404040] text-[#fafafa] rounded-lg border border-[#404040] hover:border-[#5ea9ea] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
          onClick={() => navigate('/chat/history')}
          disabled={loading}
        >
          Chat History
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
