import React, { useState, useEffect } from 'react';
import type { ChatInputProps } from '../../types';

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

const ChatInput: React.FC<ChatInputProps> = ({ repoUrl, setAnswer }) => {
  const [promptText, setPromptText] = useState('');
  const [promptType, setPromptType] = useState<PromptType>('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    const storedSessionID = localStorage.getItem('documentSessionId');
    if (storedSessionID) setSessionId(storedSessionID);
  }, []);

  const handleQuickPrompt = (prompt: string, type: PromptType) => {
    setPromptText(prompt);
    setPromptType(type);
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPromptText(event.target.value);
  };

  const handleSubmit = async () => {
    if (!promptText.trim()) return;
    setLoading(true);
    setError(null);

    try {
      console.log('📤 Making request to:', '/api/query/question');
      console.log('📤 Request body:', {
        url: repoUrl,
        prompt: promptText,
        type: promptType,
        sessionId,
      });

      const response = await fetch('/api/query/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: repoUrl,
          prompt: promptText,
          type: promptType,
          sessionId,
        }),
      });
      if (!response.ok) throw new Error('Failed to submit prompt');
      const data = await response.json();

      const snippet = data.result.response.citations?.[0].snippet ?? '';
      const file =
        data.result.response.citations?.[0].file.split('/').pop() ?? '';
      const startLine = data.result.response.citations?.[0].startLine ?? 0;
      const endLine = data.result.response.citations?.[0].endLine ?? 0;
      setAnswer(
        data.result.response.answer,
        data.result.question,
        snippet,
        file,
        startLine,
        endLine
      );

      setPromptText('');
    } catch (err) {
      if (err instanceof Error) setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='w-full max-w-2xl mx-auto flex flex-col gap-4 p-4 bg-[#232946] rounded-xl shadow-lg'>
      <div className='w-full max-w-3xl mx-auto flex justify-center space-x-2'>
        {QUICK_PROMPTS.map(({ label, text, type }) => (
          <button
            key={type}
            type='button'
            className='px-2 py-1 rounded bg-[#5ea9ea] text-[#121629] font-bold hover:bg-[#31677a] hover:text-white transition disabled:opacity-50'
            onClick={() => handleQuickPrompt(text, type)}
            disabled={loading}
          >
            {label}
          </button>
        ))}
      </div>
      <div className='relative w-full'>
        <textarea
          id='user-prompt'
          className='w-full min-h-[48px] resize-none overflow-hidden text-base p-2 pr-20 border border-[#39415a] rounded focus:outline-none focus:ring-2 focus:ring-[#5ea9ea] bg-[#181A2B] text-[#eaeaea] transition'
          placeholder='Please type your prompt here'
          value={promptText}
          onChange={handleChange}
          onInput={autoGrow}
          rows={2}
          disabled={loading}
        />
        <button
          type='button'
          className='absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded bg-[#5ea9ea] text-white font-semibold hover:bg-[#31677a] hover:text-[#181A2B] transition disabled:opacity-50'
          onClick={handleSubmit}
          disabled={loading || !promptText.trim()}
        >
          {loading ? '...' : 'Submit'}
        </button>
      </div>
      {error && <p className='text-red-400'>{error}</p>}
    </div>
  );
};

export default ChatInput;
