import React, { useEffect, useRef } from 'react';
import ChatMessage from './chatmessages';
import type { ChatWindowProps } from '../../types';

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSelectFile }) => {
  console.log('🗨️ ChatWindow received messages:', messages.length);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  messages.forEach((msg, i) => {
    if (msg.file) {
      console.log(`🗨️ Message ${i} file:`, msg.file);
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  console.log('☠️In ChatWindow, onSelectFile is:', onSelectFile);
  console.log('🎯 ChatWindow rendering:', messages.length, 'messages');

  return (
    <div>
      {messages.length === 0 && <div className="text-center text-[#7d8590] py-8">Ready when you are.</div>}

      {messages
        .filter((msg) => !!msg && typeof msg === 'object' && msg.role) // extra safety
        .map((msg, idx) => (
          <div key={idx} className="mb-4">
            <ChatMessage message={msg} onSelectFile={onSelectFile} />
          </div>
        ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatWindow;
