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
    <div className='space-y-6'>
      {messages
        .filter((msg) => !!msg && typeof msg === 'object' && msg.role) // extra safety
        .map((msg, idx) => (
          <ChatMessage key={idx} message={msg} onSelectFile={onSelectFile} />
        ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatWindow;
