import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message } from '../../types';

interface CodeProps {
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}

const ChatMessage: React.FC<{ message: Message }> = ({ message }) => {
  return (
    <div
      className={`p-3 my-2 max-w-[80%] text-sm rounded-lg
        ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
    >
      <ReactMarkdown
        components={{
          code({ inline, className, children, ...props }: CodeProps) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString =
              typeof children === 'string' ? children : Array.isArray(children) ? children.join('') : '';

            return !inline && match ? (
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                customStyle={{
                  overflowX: 'auto',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  fontFamily: `'Fira Mono', 'Menlo', 'Consolas', 'Liberation Mono', monospace`,
                }}
                {...props}
              >
                {codeString.replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code
                className="bg-gray-100 px-1 py-0.5 rounded text-sm"
                style={{
                  fontFamily: `'Fira Mono', 'Menlo', 'Consolas', 'Liberation Mono', monospace`,
                }}
                {...props}
              >
                {codeString}
              </code>
            );
          },
        }}
      >
        {message.role === 'user' ? `**_${message.content}_**` : message.content}
      </ReactMarkdown>

      {message.role !== 'user' && message.file && (
        <div className="mt-4 mb-4 text-xs text-gray-600">
          File: <span className="text-blue-500 font-mono">{message.file.split('/').pop()}</span>
          {message.startLine > 0 && (
            <span className="ml-1 text-gray-500">
              ({message.startLine}-{message.endLine})
            </span>
          )}
        </div>
      )}

      {message.role !== 'user' && message.snippet && message.snippet.trim() && (
        <pre
          className="mt-2 bg-gray-100 text-sm p-2 rounded overflow-x-auto"
          style={{
            fontFamily: `'Fira Mono', 'Menlo', 'Consolas', 'Liberation Mono', monospace`,
          }}
        >
          {message.snippet}
        </pre>
      )}
    </div>
  );
};

export default ChatMessage;
