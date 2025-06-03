import React, { useEffect, useRef } from 'react';
import ChatMessage from './chatmessages';
import type { ChatWindowProps } from '../../types';

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSelectFile }) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="w-full max-w-2xl flex flex-col mx-auto bg-[#181A2B] rounded-xl shadow-inner h-full px-4 py-6 overflow-y-auto">
      {messages.map((msg, idx) => (
        <div key={idx} className="mb-4">
          <ChatMessage message={msg} />

          {/* Render clickable file link if it's from the assistant */}
          {msg.role === 'assistant' && msg.file && (
            <p className="mt-2 text-sm text-blue-400">
              View file:{' '}
              <button onClick={() => onSelectFile(msg.file)} className="underline hover:text-blue-300 font-mono">
                {msg.file.split('/').pop()} {/* display only the file name */}
              </button>
            </p>
          )}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatWindow;
