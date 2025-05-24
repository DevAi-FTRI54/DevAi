import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coy } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Types for GitHub API
interface GithubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir';
}

interface RepoViewerProps {
  repoUrl: string; // Should be in the format "owner/repo"
  selectedPath: string;
}

const RepoViewer: React.FC<RepoViewerProps> = ({ repoUrl, selectedPath }) => {
  const [fileData, setFileData] = useState<GithubFile[] | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRepoData() {
      try {
        const response = await fetch(`https://api.github.com/repos/${repoUrl}/contents/${selectedPath}`);
        const data = await response.json();

        // If it's a directory, render directory items
        if (Array.isArray(data)) {
          setFileData(data);
          setFileContent(null);
        }
        // If it's a file, fetch its content
        else if (data.type === 'file' && data.download_url) {
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

  // Since the GitHub API does not provide tree in one go,
  // We'll display either the selected file or the selected folder
  function renderDirectory(items: GithubFile[]) {
    return (
      <ul>
        {items.map((item) => (
          <li key={item.sha}>
            {item.type === 'dir' ? (
              <strong>{item.name} (dir)</strong>
            ) : (
              <span
                style={{ cursor: 'pointer', color: 'blue' }}
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
    <div>
      <h2>Repository Files</h2>
      {fileData && renderDirectory(fileData)}
      {fileContent && (
        <div>
          <h3>{selectedPath}</h3>
          <SyntaxHighlighter language={getLanguage(selectedPath)} style={coy}>
            {fileContent}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
};

export default RepoViewer;
