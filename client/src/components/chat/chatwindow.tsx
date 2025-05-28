import React, { useEffect, useRef } from 'react';
import ChatMessage from './chatmessages';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  snippet: string;
  file: string;
  startLine: number;
  endLine: number;
};

type ChatWindowProps = {
  messages: Message[];
};

const ChatWindow: React.FC<ChatWindowProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="w-full max-w-2xl flex flex-col mx-auto bg-[#181A2B] rounded-xl shadow-inner h-full">
      <div className="flex-1 overflow-y-auto px-4 py-6 min-h-[200px]">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 italic">Start a conversation to get help with your codebase</div>
        )}
        {messages.map((msg, idx) => (
          <ChatMessage key={idx} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatWindow;
