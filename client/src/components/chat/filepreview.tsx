import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { GithubFile, RepoViewerProps } from '../../types';

const RepoViewer: React.FC<RepoViewerProps> = ({ repoUrl, selectedPath }) => {
  const [fileData, setFileData] = useState<GithubFile[] | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRepoData() {
      try {
        const response = await fetch(`https://api.github.com/repos/${repoUrl}/contents/${selectedPath}`);
        const data = await response.json();

        if (Array.isArray(data)) {
          setFileData(data);
          setFileContent(null);
        } else if (data.type === 'file' && data.download_url) {
          const contentRes = await fetch(data.download_url);
          const content = await contentRes.text();
          setFileContent(content);
          setFileData(null);
        }
      } catch (error) {
        console.error('Error fetching repo data:', error);
      }
    }
    fetchRepoData();
  }, [repoUrl, selectedPath]);

  async function fetchFileContent(fileUrl: string) {
    try {
      const response = await fetch(fileUrl);
      const content = await response.text();
      setFileContent(content);
    } catch (error) {
      console.error('Error fetching file content:', error);
    }
  }

  function renderDirectory(items: GithubFile[]) {
    return (
      <ul className="pl-4 space-y-1">
        {items.map((item) => (
          <li key={item.sha}>
            {item.type === 'dir' ? (
              <strong className="text-blue-400">{item.name} (dir)</strong>
            ) : (
              <span
                className="cursor-pointer text-blue-500 hover:underline"
                onClick={() => item.download_url && fetchFileContent(item.download_url)}
              >
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ul>
    );
  }

  function getLanguage(filename: string): string {
    if (filename.endsWith('.js')) return 'javascript';
    if (filename.endsWith('.jsx')) return 'jsx';
    if (filename.endsWith('.ts')) return 'typescript';
    if (filename.endsWith('.tsx')) return 'tsx';
    if (filename.endsWith('.json')) return 'json';
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.md')) return 'markdown';
    if (filename.endsWith('.py')) return 'python';
    return 'text';
  }

  return (
    <div className="w-full">
      {/* Repo and Path in one line, file path smaller */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-lg font-semibold text-gray-400">Repo:</span>
        {selectedPath && (
          <span className="text-lg text-gray-400 break-all truncate max-w-xs" title={selectedPath}>
            /{selectedPath}
          </span>
        )}
      </div>

      {/* Directory or file view */}
      {fileData && renderDirectory(fileData)}

      {fileContent && (
        <div className="mt-4">
          {/* Syntax-highlighted code block */}
          <div className="rounded-lg overflow-hidden border border-[#39415a] bg-[#161b2a]">
            <SyntaxHighlighter
              language={getLanguage(selectedPath)}
              style={coy}
              customStyle={{ margin: 0, background: 'transparent', fontSize: 14 }}
              wrapLongLines
              showLineNumbers
            >
              {fileContent}
            </SyntaxHighlighter>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepoViewer;
