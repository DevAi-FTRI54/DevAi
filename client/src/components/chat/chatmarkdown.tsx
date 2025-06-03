// components/common/ChatMarkdown.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const ChatMarkdown: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="prose prose-invert text-[#eaeaea] max-w-none text-sm leading-relaxed">
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
                  margin: '1rem 0',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  fontSize: '0.875rem',
                  backgroundColor: '#0d1117',
                  border: '1px solid #39415a',
                }}
                {...props}
              >
                {codeString.replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code
                className="bg-[#0d1117] border border-[#39415a] text-[#f0f6fc] px-2 py-1 rounded text-xs"
                style={{ fontFamily: `'Fira Code', 'Monaco', 'Consolas', monospace` }}
                {...props}
              >
                {codeString}
              </code>
            );
          },
          p: ({ children }) => <p className="mb-3">{children}</p>,
          h1: ({ children }) => <h1 className="text-xl font-bold text-[#f0f6fc] mt-6 mb-3">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold text-[#f0f6fc] mt-5 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-md font-bold text-[#f0f6fc] mt-4 mb-2">{children}</h3>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-3 ml-4">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-3 ml-4">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#5ea9ea] pl-4 italic text-[#b1bac4] mb-3">{children}</blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default ChatMarkdown;
