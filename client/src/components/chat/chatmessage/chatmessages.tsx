import React from 'react';
import ReactMarkdown from 'react-markdown'; // Markdown renderer for React
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'; // Prism-based syntax highlighter for code blocks
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Dark theme for Prism code highlighting
import styles from './chatmessage.module.css';

// Message type: represents one chat message from user or assistant
type Message = { role: 'user' | 'assistant'; content: string };

// Props type for code renderer override (used by react-markdown below)
type CodeProps = {
  node?: any; // Internal tree node, not used here
  inline?: boolean; // True for inline code (`like this`), false for code blocks (```code```)
  className?: string; // May include language info (e.g., 'language-js')
  children: React.ReactNode[]; // The actual code content
};

const ChatMessage: React.FC<{ message: Message }> = ({ message }) => (
  <div className={message.role === 'user' ? styles.userBubble : styles.aiBubble}>
    {/* Render markdown content; override code blocks for syntax highlighting */}
    <ReactMarkdown
      components={{
        // Custom code block renderer for react-markdown
        code({ inline, className, children, ...props }: CodeProps) {
          // Extract language if specified (e.g., ```js)
          const match = /language-(\w+)/.exec(className || '');
          // If this is a code block and language specified, use SyntaxHighlighter
          return !inline && match ? (
            <SyntaxHighlighter style={oneDark} language={match[1]}>
              {/* Remove trailing newlines for cleaner formatting */}
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            // Otherwise, render inline code normally
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {message.content}
    </ReactMarkdown>
  </div>
);

export default ChatMessage;
