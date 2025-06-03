import React, { useEffect, useRef } from 'react';
import ChatMessage from './chatmessages';
import type { Message } from '../../types';

type ChatWindowProps = {
  messages: Message[];
};

const ChatWindow: React.FC<ChatWindowProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  console.log('🎯 ChatWindow rendering:', messages.length, 'messages');

  return (
    <div>
      {messages.length === 0 && (
        <div className='text-center text-[#7d8590] py-8'>
          Ready when you are.
        </div>
      )}

      {messages.map((msg, idx) => (
        <ChatMessage key={idx} message={msg} />
      ))}
    </div>
  );
};

export default ChatWindow;
