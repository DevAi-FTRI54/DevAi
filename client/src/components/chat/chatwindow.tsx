import React, { useEffect, useRef } from 'react';
import ChatMessage from './chatmessages';
import type { ChatWindowProps } from '../../types';

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSelectFile }) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  console.log('☠️In ChatWindow, onSelectFile is:', onSelectFile);
  console.log('🎯 ChatWindow rendering:', messages.length, 'messages');

  return (
    <div>
      {messages.length === 0 && <div className="text-center text-[#7d8590] py-8">Ready when you are.</div>}

      {messages.map((msg, idx) => (
        <div key={idx} className="mb-4">
          <ChatMessage message={msg} onSelectFile={onSelectFile} />

          {/* Render clickable file link if it's from the assistant */}
          {/* {msg.role === 'assistant' && msg.file && (
            <p className="mt-2 text-sm text-blue-400">
              View file:{' '}
              <button onClick={() => onSelectFile(msg.file)} className="underline hover:text-blue-300 font-mono">
                {msg.file.split('/').pop()}
              </button>
            </p>
          )} */}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatWindow;
