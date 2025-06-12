export interface ChatHistoryEntry {
  userPrompt: string;
  answer: string;
  file?: string;
  startLine?: number;
  endLine?: number;
  timestamp: Date;
  conversationId?: string;
}

export interface ChatInputProps {
  repoUrl: string;
  setAnswer: (
    answer: string,
    // userPrompt: string,
    snippet: string,
    file: string,
    startLine: number,
    endLine: number
  ) => void;
  addUserMessage: (userPrompt: string) => void;
  setStreamingAnswer?: (answer: string) => void;
  setIsStreaming?: (streaming: boolean) => void;
  setIsLoadingResponse?: (loading: boolean) => void;
}
export interface ChatWindowProps {
  messages: Message[];
  onSelectFile: (filePath: string) => void;
}

export interface ChatWrapProps {
  repo: {
    id: number;
    full_name: string;
    html_url: string;
    sha: string;
    org: string;
    installationId: string | null;
  };
  org?: string;
  installationId?: string | null;
}

export interface GitHubContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

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
export interface GitHubLazyFileTreeProps {
  owner: string;
  repo: string;
  token?: string;
  onFileSelect?: (filePath: string) => void;
}

export type IngestionContextType = {
  jobId: string | null;
  selectedRepo: Repo | null;
  selectedOrg: string | null;
  installationId: string | null;
  handleStartIngestion: (jobId: string, repo: Repo) => void;
  setJobId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedRepo: React.Dispatch<React.SetStateAction<Repo | null>>;
  setSelectedOrg: React.Dispatch<React.SetStateAction<string | null>>;
  setInstallationId: React.Dispatch<React.SetStateAction<string | null>>;
};

export interface IngestionStatusData {
  repoUrl: string;
  status: 'pending' | 'indexing' | 'completed' | 'failed';
  lastUpdated: string;
  percentage: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  snippet?: string;
  file?: string;
  startLine?: number;
  endLine?: number;
}

export type OrgSelectorProps = {
  token: string;
  onSelect: () => void;
};

export interface Props {
  sidebar: React.ReactNode;
  chat: React.ReactNode;
  fileViewer: React.ReactNode;
  onFileSelect?: (filePath: string) => void;
}

export type Repo = {
  id: number;
  full_name: string;
  html_url: string;
  sha: string;
};

export interface RepoSelectorProps {
  onStartIngestion: (jobId: string, repo: Repo) => void;
  compact?: boolean;
  org?: string | null;
  installationId?: string | null;
}
export interface RepoViewerProps {
  repoUrl: string; // Should be in the format "owner/repo"
  selectedPath: string;
  token: string;
  setSelectedPath: (path: string) => void;
}

export interface SidebarProps {
  owner: string;
  repo: string;
  token: string;
  onFileSelect: (filePath: string) => void;
  org?: string;
  installationId?: string | null;
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
export interface UserSettingsProps {
  apiKey?: string;
  onSave?: (key: string) => void;
}
