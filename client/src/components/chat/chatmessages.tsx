import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message } from '../../types';

interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// Helper to get language for syntax highlighting
const getLanguageFromFilename = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: { [key: string]: string } = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    sql: 'sql',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    md: 'markdown',
  };
  return langMap[ext || ''] || 'text';
};

// Add onSelectFile as an optional prop
const ChatMessage: React.FC<{
  message: Message;
  onSelectFile?: (filePath: string) => void;
}> = ({ message, onSelectFile }) => {
  console.log('👌>>> ChatMessage component file loaded!');
  console.log(
    '🥊In ChatMessage, onSelectFile:',
    onSelectFile,
    'file:',
    message.file
  );

  return (
    <div className='mb-8'>
      {message.role === 'user' ? (
        <div className='flex justify-end'>
          <div className='max-w-[80%] bg-[#5ea9ea] text-white rounded-3xl rounded-br-lg px-6 py-4 shadow-sm'>
            <div className='leading-relaxed'>{message.content}</div>
          </div>
        </div>
      ) : (
        <div className='flex justify-start'>
          <div className='max-w-[85%] bg-[#212121] border border-[#303030]/50 rounded-3xl rounded-bl-lg px-6 py-4 shadow-sm'>
            {/* AI Avatar and Content */}
            <div className='flex gap-2'>
              <div className='w-6 h-6 bg-gradient-to-br from-[#5ea9ea] to-[#4a9ae0] rounded-full flex items-center justify-center flex-shrink-0 mt-1'>
                <svg
                  className='w-3.5 h-3.5 text-white'
                  fill='currentColor'
                  viewBox='0 0 20 20'
                >
                  <path
                    fillRule='evenodd'
                    d='M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>

              <div className='flex-1 min-w-0'>
                <div className='text-[#fafafa] leading-relaxed prose prose-invert max-w-none'>
                  <ReactMarkdown
                    components={{
                      code({
                        inline,
                        className,
                        children,
                        ...props
                      }: CodeProps) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeString =
                          typeof children === 'string'
                            ? children
                            : Array.isArray(children)
                            ? children.join('')
                            : '';

                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            customStyle={{
                              margin: '1rem 0',
                              borderRadius: '12px',
                              padding: '1rem',
                              fontSize: '0.875rem',
                              backgroundColor: '#0d1117',
                              border: '1px solid #303030',
                            }}
                            {...props}
                          >
                            {codeString.replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code
                            className='bg-[#303030] text-[#fafafa] px-2 py-1 rounded-md text-sm border border-[#404040]'
                            style={{
                              fontFamily: `'Fira Code', 'Monaco', 'Consolas', monospace`,
                            }}
                            {...props}
                          >
                            {codeString}
                          </code>
                        );
                      },
                      p: ({ children }) => (
                        <p className='text-[#fafafa] leading-relaxed mb-4 last:mb-0'>
                          {children}
                        </p>
                      ),
                      h1: ({ children }) => (
                        <h1 className='text-xl font-bold text-[#fafafa] mt-6 mb-3 first:mt-0'>
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className='text-lg font-bold text-[#fafafa] mt-5 mb-2 first:mt-0'>
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className='text-md font-bold text-[#fafafa] mt-4 mb-2 first:mt-0'>
                          {children}
                        </h3>
                      ),
                      ul: ({ children }) => (
                        <ul className='list-disc list-inside text-[#fafafa] mb-4 ml-4 space-y-1'>
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className='list-decimal list-inside text-[#fafafa] mb-4 ml-4 space-y-1'>
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className='leading-relaxed'>{children}</li>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className='border-l-4 border-[#5ea9ea] pl-4 italic text-[#ccc] mb-4 bg-[#303030]/30 py-2 rounded-r-lg'>
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>

                {/* File information */}
                {message.file && (
                  <div className='mt-6 pt-4 border-t border-[#303030]/50'>
                    <div className='flex items-center gap-2 text-sm text-[#888] mb-3'>
                      <div className='w-4 h-4 bg-[#5ea9ea]/20 rounded flex items-center justify-center'>
                        <svg
                          className='w-3 h-3 text-[#5ea9ea]'
                          fill='currentColor'
                          viewBox='0 0 20 20'
                        >
                          <path d='M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z' />
                        </svg>
                      </div>
                      {onSelectFile ? (
                        <button
                          onClick={() => onSelectFile(message.file!)}
                          className='font-medium text-[#5ea9ea] hover:text-[#4a9ae0] transition-colors underline decoration-dotted'
                          title={message.file} // show full path on hover
                        >
                          {message.file.split('/').pop()}
                        </button>
                      ) : (
                        <span
                          className='font-medium text-[#fafafa]'
                          title={message.file}
                        >
                          {message.file.split('/').pop()}
                        </span>
                      )}
                      {message.startLine &&
                        message.endLine &&
                        message.startLine > 0 && (
                          <span className='text-[#5ea9ea] bg-[#5ea9ea]/10 px-2 py-0.5 rounded-full text-xs'>
                            Lines {message.startLine}-{message.endLine}
                          </span>
                        )}
                    </div>
                    {message.snippet && message.snippet.trim() && (
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={getLanguageFromFilename(message.file || '')}
                        customStyle={{
                          margin: 0,
                          borderRadius: '12px',
                          padding: '1rem',
                          fontSize: '0.8rem',
                          backgroundColor: '#0d1117',
                          border: '1px solid #303030',
                        }}
                      >
                        {message.snippet}
                      </SyntaxHighlighter>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
