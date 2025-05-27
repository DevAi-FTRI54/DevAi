import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message } from '../../types';

const ChatMessage: React.FC<{ message: Message }> = ({ message }) => {
  return (
    <div
      className={`p-3 my-2 max-w-[80%] text-sm rounded-lg ${
        message.role === 'user'
          ? 'bg-blue-500 text-white self-end ml-auto'
          : 'bg-gray-200 text-black self-start mr-auto'
      }`}
    >
      <ReactMarkdown
        components={{
          code({ inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = Array.isArray(children) ? children.join('') : String(children);

            return !inline && match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                customStyle={{ overflowX: 'auto', borderRadius: '0.5rem', padding: '1rem' }}
                {...props}
              >
                {codeString.replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props}>
                {codeString}
              </code>
            );
          },
        }}
      >
        {message.content}
      </ReactMarkdown>
      <div className="mt-4 mb-4">
        File: {message.file}: ({message.startLine}-{message.endLine})
      </div>

      {message.snippet && <pre className="mt-2 bg-gray-100 text-sm p-2 rounded overflow-x-auto">{message.snippet}</pre>}
    </div>
  );
};

export default ChatMessage;
