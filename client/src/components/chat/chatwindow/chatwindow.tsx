import React, { useEffect, useRef } from 'react';
import ChatMessage from '../chatmessage/chatmessages.tsx';
// import styles from './chatwindow.module.css';

//* Used to define the message type
type Message = {
  role: 'user' | 'assistant';
  content: string;
  snippet: string;
};

//* Props interface: messages are passed in from parent
type ChatWindowProps = {
  messages: Message[];
};

//* define the component
const ChatWindow: React.FC<ChatWindowProps> = ({ messages }) => {
  // * Ref points to an invisible element at the bottom of the messages list for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // * Auto-scroll to the bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]); // * Triggers scroll when messages update (re-render)

  return (
    // <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg flex flex-col mx-auto">
    //   <div className="py-6 px-4 border-b flex flex-col items-center">
    //     <h2 className="text-2xl font-bold text-center">DevAi Onboarding Assistant</h2>
    //     <span className="text-sm text-gray-500 mt-1 text-center">
    //       Ask anything about this codebase during your onboarding
    //     </span>
    //   </div>
    //   <div className="flex-1 overflow-y-auto px-4 py-6 min-h-[200px]">
    //     {messages.length === 0 && (
    //       <div className="text-center text-gray-400 italic">Start a conversation to get help with your codebase</div>
    //     )}
    //     {messages.map((msg, idx) => (
    //       <ChatMessage key={idx} message={msg} />
    //     ))}
    //     <div ref={messagesEndRef} />
    //   </div>
    // </div>
    <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg flex flex-col mx-auto">
      <div className="py-6 px-4 border-b flex flex-col items-center">
        <h2 className="text-2xl font-bold text-center">DevAi Onboarding Assistant</h2>
        <span className="text-sm text-gray-500 mt-1 text-center">
          Ask anything about this codebase during your onboarding
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6 min-h-[200px] max-h-[500px]">
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
