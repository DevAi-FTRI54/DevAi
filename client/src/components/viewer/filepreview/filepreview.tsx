import React, { useState, useEffect } from 'react';

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

  return (
    <div>
      <h2>Repository Files</h2>
      {renderDirectory(fileData)}
      {selectedFile && (
        <div>
          <h3>{selectedFile.url}</h3>
          <pre>{selectedFile.content}</pre>
        </div>
      )}
    </div>
  );
};

export default RepoViewer;
