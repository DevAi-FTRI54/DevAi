import React, { useEffect, useRef } from 'react';
import styles from './chatwindow.module.css';

//* Used to define the message type
type Message = {
  role: 'user' | 'assistant';
  content: string;
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
    <div className={styles.chatWindowContainer}>
      <div className={styles.header}>
        <h2>DevAi Onboarding Assistant</h2>
        <span className={styles.caption}>Ask anything about this codebase during your onboarding</span>
      </div>
      <div className={styles.messagesArea}>
        {/* * Render empty state if there are no messages */}
        {messages.length === 0 && (
          <div className={styles.emptyState}>start a conversation to get help with your codebase</div>
        )}
        {/* * Map over messages and render each as a chat bubble */}
        {messages.map((msg, idx) => (
          <div key={idx} className={msg.role === 'user' ? styles.userMessage : styles.assistantMessage}>
            {msg.content}
          </div>
        ))}
        {/* * Dummy div for scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatWindow;
