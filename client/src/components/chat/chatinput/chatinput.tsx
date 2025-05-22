import React, { useEffect, useState } from 'react';

interface ChatInputProps {
  setAnswer: (answer: string, userPrompt: string) => void;
}

type PromptType = 'default' | 'Find' | 'Bugs' | 'Debug' | 'WalkThrough' | 'Services';

const QUICK_PROMPTS: Array<{ label: string; text: string; type: PromptType }> = [
  { label: 'Find & Explain', text: 'Find and explain the logic for the following: ', type: 'Find' },
  { label: 'Common Bugs', text: 'What are the most common bugs or pitfalls in this repo?', type: 'Bugs' },
  { label: 'Debug', text: 'Where do I start to debug this type of problem?', type: 'Debug' },
  { label: 'Walkthrough', text: 'Walk me through the data flow for ...', type: 'WalkThrough' },
  { label: 'Services', text: 'List all the third-party services used in this repo', type: 'Services' },
];

const autoGrow = (event: React.FormEvent<HTMLTextAreaElement>) => {
  const textarea = event.currentTarget;
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
};

const ChatInput: React.FC<ChatInputProps> = ({ setAnswer }) => {
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
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, type: promptType, sessionId }),
      });
      if (!response.ok) throw new Error('Failed to submit prompt');
      const data = await response.json();
      setAnswer(data.answer, promptText);
    } catch (err) {
      if (err instanceof Error) setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-4 p-4 bg-white rounded shadow">
      <div className="flex flex-wrap gap-2 mb-2">
        {QUICK_PROMPTS.map(({ label, text, type }) => (
          <button
            key={type}
            type="button"
            className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-50"
            onClick={() => handleQuickPrompt(text, type)}
            disabled={loading}
          >
            {label}
          </button>
        ))}
      </div>
      <div>
        <textarea
          id="user-prompt"
          className="w-full min-h-[48px] resize-y text-base p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          placeholder="Please type your prompt here"
          value={promptText}
          onChange={handleChange}
          onInput={autoGrow}
          rows={6}
          disabled={loading}
        />
      </div>
      <button
        type="button"
        className="self-end px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition disabled:opacity-50"
        onClick={handleSubmit}
        disabled={loading || !promptText.trim()}
      >
        {loading ? 'Submitting...' : 'Submit'}
      </button>
      {error && <p className="text-red-600">{error}</p>}

      <div className="bg-red-500 text-white p-10">If this is red, Tailwind is working!</div>
    </div>
  );
};

export default ChatInput;
