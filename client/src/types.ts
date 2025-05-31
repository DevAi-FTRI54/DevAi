export interface GitHubLazyFileTreeProps {
  owner: string;
  repo: string;
  token?: string;
  onFileSelect?: (filePath: string) => void;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  snippet?: string;
  file?: string;
  startLine?: number;
  endLine?: number;
}

export interface ChatInputProps {
  repoUrl: string;
  setAnswer: (
    answer: string,
    userPrompt: string,
    snippet: string,
    file: string,
    startLine: number,
    endLine: number
  ) => void;
}

//* This file handles recursive rendering & lazy loading of the file tree from GitHub
export interface GitHubContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

export interface TreeNodeProps {
  name: string;
  path: string;
  type: 'file' | 'dir';
  owner: string;
  repo: string;
  token?: string;
  onFileSelect?: (filePath: string) => void;
}

// Types for GitHub API
export interface GithubFile {
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

export interface RepoViewerProps {
  repoUrl: string; // Should be in the format "owner/repo"
  selectedPath: string;
}

export interface Props {
  sidebar: React.ReactNode;
  chat: React.ReactNode;
  fileViewer: React.ReactNode;
  onFileSelect?: (filePath: string) => void;
}

export interface IngestionStatusData {
  repoUrl: string;
  status: 'pending' | 'indexing' | 'completed' | 'failed';
  lastUpdated: string;
  percentage: number;
}

export interface ChatWrapProps {
  repo: {
    id: number;
    full_name: string;
    html_url: string;
    sha: string;
  };
}

export interface Repo {
  id: number;
  full_name: string;
  html_url: string;
  sha: string;
}
