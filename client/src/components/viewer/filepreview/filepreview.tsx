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

interface SelectedFile {
  url: string;
  content: string;
}

interface RepoViewerProps {
  repoUrl: string; // Should be in the format "owner/repo"
}

const RepoViewer: React.FC<RepoViewerProps> = ({ repoUrl }) => {
  const [fileData, setFileData] = useState<GithubFile[] | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);

  useEffect(() => {
    async function fetchRepoData() {
      try {
        const response = await fetch(`https://api.github.com/repos/${repoUrl}/contents`);
        const data: GithubFile[] = await response.json();
        setFileData(data);
      } catch (error) {
        console.error('Error fetching repo data:', error);
      }
    }
    fetchRepoData();
  }, [repoUrl]);

  async function fetchFileContent(fileUrl: string) {
    try {
      const response = await fetch(fileUrl);
      const content = await response.text();
      setSelectedFile({ url: fileUrl, content });
    } catch (error) {
      console.error('Error fetching file content:', error);
    }
  }

  // Since the GitHub API does not provide tree in one go,
  // We'll display just the root directory for now.
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

  if (!fileData) {
    return <div>Loading...</div>;
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
      {renderDirectory(fileData)}
      {selectedFile && (
        <div>
          <h3>{selectedFile.url}</h3>
          <SyntaxHighlighter language={getLanguage(selectedFile.url)} style={coy}>
            {selectedFile.content}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
};

export default RepoViewer;
