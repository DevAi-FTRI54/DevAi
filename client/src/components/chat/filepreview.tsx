import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message } from '../../types';

interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

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

// Helper to get filename from path
const getFileNameFromPath = (path: string) => path.split('/').pop();

const ChatMessage: React.FC<{
  message: Message;
  onSelectFile?: (filePath: string) => void;
}> = ({ message, onSelectFile }) => {
  // (debug logs removed for clarity)

  return (
    <div className='mb-6'>
      {message.role === 'user' ? (
        <div className='flex justify-end mb-4'>
          <div className='max-w-[80%] bg-[#5ea9ea] text-white p-4 rounded-2xl rounded-br-md'>
            <div className='text-sm leading-relaxed'>{message.content}</div>
          </div>
        </div>
      ) : (
        <div className='flex justify-start mb-4'>
          <div className='max-w-[90%] bg-[#181A2B] border border-[#39415a] p-4 rounded-2xl rounded-bl-md'>
            {/* ✅ Add wrapper div for styling */}
            <div className='text-[#eaeaea] text-sm leading-relaxed prose prose-invert max-w-none'>
              <ReactMarkdown
                components={{
                  code({ inline, className, children, ...props }: CodeProps) {
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
                        className='bg-[#0d1117] border border-[#39415a] text-[#f0f6fc] px-2 py-1 rounded text-xs'
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
                    <p className='text-[#eaeaea] leading-relaxed mb-3'>
                      {children}
                    </p>
                  ),
                  h1: ({ children }) => (
                    <h1 className='text-xl font-bold text-[#f0f6fc] mt-6 mb-3'>
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className='text-lg font-bold text-[#f0f6fc] mt-5 mb-2'>
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className='text-md font-bold text-[#f0f6fc] mt-4 mb-2'>
                      {children}
                    </h3>
                  ),
                  ul: ({ children }) => (
                    <ul className='list-disc list-inside text-[#eaeaea] mb-3 ml-4'>
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className='list-decimal list-inside text-[#eaeaea] mb-3 ml-4'>
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li className='mb-1'>{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className='border-l-4 border-[#5ea9ea] pl-4 italic text-[#b1bac4] mb-3'>
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>

            {/* ✅ File information */}
            {message.file && (
              <div className='mt-4 pt-3 border-t border-[#39415a]'>
                <div className='flex items-center gap-2 text-xs text-[#7d8590] mb-2'>
                  <svg
                    className='w-4 h-4'
                    fill='currentColor'
                    viewBox='0 0 20 20'
                  >
                    <path d='M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z' />
                  </svg>
                  {onSelectFile ? (
                    <button
                      onClick={() => onSelectFile(message.file!)}
                      className='font-medium text-blue-400 underline hover:text-blue-300'
                      title={message.file} // Show full path on hover
                    >
                      {getFileNameFromPath(message.file)}
                    </button>
                  ) : (
                    <span className='font-medium' title={message.file}>
                      {getFileNameFromPath(message.file)}
                    </span>
                  )}
                  {message.startLine &&
                    message.endLine &&
                    message.startLine > 0 && (
                      <span className='text-[#5ea9ea]'>
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
                      borderRadius: '0.375rem',
                      padding: '0.75rem',
                      fontSize: '0.75rem',
                      backgroundColor: '#0d1117',
                      border: '1px solid #39415a',
                    }}
                  >
                    {message.snippet}
                  </SyntaxHighlighter>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export { ChatMessage };

interface FilePreviewProps {
  repoUrl: string; // "owner/repo"
  selectedPath: string;
  setSelectedPath?: (p: string) => void;
  token: string;
}

const FilePreview: React.FC<FilePreviewProps> = ({
  repoUrl,
  selectedPath,
  token,
}) => {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPath) return;
    setContent(null);
    setError(null);

    const fetchFile = async () => {
      try {
        console.log('🔍 FilePreview fetching:', {
          repoUrl,
          selectedPath,
          fullUrl: `https://api.github.com/repos/${repoUrl}/contents/${selectedPath}`,
        });

        const res = await fetch(
          `https://api.github.com/repos/${repoUrl}/contents/${selectedPath}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) throw new Error('Failed to fetch file');
        const data = await res.json();
        // GitHub returns content as base64
        const decoded = atob(data.content.replace(/\n/g, ''));
        setContent(decoded);
      } catch (err) {
        setError('Could not load file.');
        console.error('Error found could not load file', err);
      }
    };

    fetchFile();
  }, [repoUrl, selectedPath, token]);

  if (!selectedPath)
    return (
      <div className='flex flex-col items-center justify-center h-64 text-center'>
        <div className='w-12 h-12 bg-[#303030] rounded-lg flex items-center justify-center mb-4'>
          <svg
            className='w-6 h-6 text-[#888]'
            fill='currentColor'
            viewBox='0 0 20 20'
          >
            <path d='M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z' />
          </svg>
        </div>
        <p className='text-[#888] text-sm'>No file selected</p>
      </div>
    );

  if (error)
    return (
      <div className='flex flex-col items-center justify-center h-64 text-center'>
        <div className='w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center mb-4'>
          <svg
            className='w-6 h-6 text-red-400'
            fill='currentColor'
            viewBox='0 0 20 20'
          >
            <path
              fillRule='evenodd'
              d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z'
              clipRule='evenodd'
            />
          </svg>
        </div>
        <p className='text-red-400 text-sm'>{error}</p>
      </div>
    );

  if (!content)
    return (
      <div className='flex flex-col items-center justify-center h-64 text-center'>
        <div className='w-8 h-8 border-2 border-[#5ea9ea] border-t-transparent rounded-full animate-spin mb-4'></div>
        <p className='text-[#888] text-sm'>Loading file content...</p>
      </div>
    );

  const lang = getLanguageFromFilename(selectedPath);

  return (
    <div className='h-full flex flex-col'>
      {/* File Header */}
      <div className='flex-shrink-0 bg-[#303030] rounded-lg p-3 mb-4 border border-[#404040]'>
        <div className='flex items-center gap-2 text-sm'>
          <div className='w-4 h-4 bg-[#5ea9ea]/20 rounded flex items-center justify-center'>
            <svg
              className='w-3 h-3 text-[#5ea9ea]'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path d='M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z' />
            </svg>
          </div>
          <span className='font-medium text-[#fafafa]'>
            {selectedPath.split('/').pop()}
          </span>
        </div>
        <div className='mt-2 text-xs text-[#888] font-mono'>{selectedPath}</div>
      </div>

      {/* File Content */}
      <div className='flex-1 overflow-auto bg-[#171717] rounded-lg border border-[#303030]'>
        <SyntaxHighlighter
          language={lang}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            background: 'transparent',
            fontSize: '14px',
            lineHeight: '1.5',
            padding: '1rem',
          }}
          wrapLongLines
          showLineNumbers
          lineNumberStyle={{
            color: '#6b7280',
            fontSize: '12px',
            paddingRight: '1rem',
            userSelect: 'none',
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default FilePreview;
