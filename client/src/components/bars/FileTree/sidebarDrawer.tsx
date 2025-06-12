import React, { useEffect, useState } from 'react';
import type { GitHubContentItem, SidebarProps } from '../../../types';
import IngestionExperience from '../../ingestion/ingestionexperience';
import {
  VscFile,
  VscFileCode,
  VscFilePdf,
  VscFileMedia,
  VscFileZip,
  VscFolder,
  VscFolderOpened,
  VscFileBinary,
} from 'react-icons/vsc';
import {
  SiTypescript,
  SiJavascript,
  SiReact,
  SiJson,
  SiHtml5,
  SiCss3,
  SiMarkdown,
} from 'react-icons/si';

const Sidebar: React.FC<SidebarProps> = ({
  owner,
  repo,
  token,
  onFileSelect,
  org,
  installationId,
}) => {
  const [rootItems, setRootItems] = useState<GitHubContentItem[]>([]);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [childrenMap, setChildrenMap] = useState<
    Record<string, GitHubContentItem[]>
  >({});

  useEffect(() => {
    const fetchRoot = async () => {
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents`,
        { headers }
      );
      const data: GitHubContentItem[] = await res.json();
      setRootItems(data);
    };
    fetchRoot();
  }, [owner, repo, token]);

  const handleToggle = async (path: string) => {
    setExpandedMap((prev) => ({ ...prev, [path]: !prev[path] }));

    if (!childrenMap[path]) {
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        { headers }
      );
      const data: GitHubContentItem[] = await res.json();
      setChildrenMap((prev) => ({ ...prev, [path]: data }));
    }
  };

  // Choose an icon based on file type/extension
  const getFileIcon = (item: GitHubContentItem, expanded: boolean) => {
    if (item.type === 'dir') {
      return expanded ? (
        <VscFolderOpened className='w-4 h-4 text-[#5ea9ea]' />
      ) : (
        <VscFolder className='w-4 h-4 text-[#888]' />
      );
    }

    // React-specific: .tsx and .jsx
    if (item.name.endsWith('.tsx') || item.name.endsWith('.jsx')) {
      return <SiReact className='w-4 h-4 text-[#61dafb]' />;
    }
    // TypeScript: .ts (but not .tsx)
    if (item.name.endsWith('.ts') && !item.name.endsWith('.tsx')) {
      return <SiTypescript className='w-4 h-4 text-[#3178c6]' />;
    }
    // JavaScript: .js (but not .jsx)
    if (item.name.endsWith('.js') && !item.name.endsWith('.jsx')) {
      return <SiJavascript className='w-4 h-4 text-[#f0db4f]' />;
    }
    // JSON
    if (item.name.endsWith('.json')) {
      return <SiJson className='w-4 h-4 text-[#ff8c00]' />;
    }
    // HTML
    if (item.name.endsWith('.html')) {
      return <SiHtml5 className='w-4 h-4 text-[#e34f26]' />;
    }
    // CSS
    if (item.name.endsWith('.css')) {
      return <SiCss3 className='w-4 h-4 text-[#1572b6]' />;
    }
    // Markdown
    if (item.name.endsWith('.md')) {
      return <SiMarkdown className='w-4 h-4 text-[#888]' />;
    }

    // Package files
    if (item.name === 'package.json') {
      return <VscFileCode className='w-4 h-4 text-[#cb3837]' />;
    }

    // Config files
    if (item.name.endsWith('.yml') || item.name.endsWith('.yaml')) {
      return <VscFileCode className='w-4 h-4 text-[#cc1018]' />;
    }

    // Docker files
    if (item.name === 'Dockerfile' || item.name.startsWith('docker-compose')) {
      return <VscFileCode className='w-4 h-4 text-[#2496ed]' />;
    }

    // Generic code file
    const ext = item.name.split('.').pop()?.toLowerCase();
    if (
      ['py', 'rb', 'java', 'go', 'c', 'cpp', 'cs', 'php', 'sh'].includes(
        ext || ''
      )
    ) {
      return <VscFileCode className='w-4 h-4 text-[#5ea9ea]' />;
    }
    if (
      [
        'png',
        'jpg',
        'jpeg',
        'gif',
        'svg',
        'bmp',
        'webp',
        'ico',
        'mp4',
        'mp3',
        'webm',
        'mov',
      ].includes(ext || '')
    ) {
      return <VscFileMedia className='w-4 h-4 text-[#ff9f43]' />;
    }
    if (['zip', 'rar', 'tar', 'gz', 'bz2', '7z'].includes(ext || '')) {
      return <VscFileZip className='w-4 h-4 text-[#888]' />;
    }
    if (['pdf'].includes(ext || '')) {
      return <VscFilePdf className='w-4 h-4 text-[#ff6b6b]' />;
    }
    if (['exe', 'bin', 'dll', 'so', 'dylib'].includes(ext || '')) {
      return <VscFileBinary className='w-4 h-4 text-[#888]' />;
    }
    return <VscFile className='w-4 h-4 text-[#ccc]' />;
  };

  const renderTree = (
    items: GitHubContentItem[],
    level = 0
  ): React.ReactElement[] => {
    return items.map((item) => {
      const isDir = item.type === 'dir';
      const expanded = expandedMap[item.path];

      return (
        <div
          key={item.path}
          style={{ marginLeft: level * 16 }}
          className='text-sm'
        >
          <div
            onClick={() =>
              isDir ? handleToggle(item.path) : onFileSelect(item.path)
            }
            className={`cursor-pointer py-0.5 px-2 rounded-md transition-all duration-200 flex items-center gap-2 hover:bg-[#303030] group
              ${isDir ? 'text-[#fafafa]' : 'text-[#ccc] hover:text-[#fafafa]'}
            `}
          >
            <span className='flex-shrink-0'>{getFileIcon(item, expanded)}</span>
            <span className='truncate text-sm'>{item.name}</span>
          </div>
          {isDir && expanded && childrenMap[item.path] && (
            <div className='ml-2 border-l border-[#404040] pl-2'>
              {renderTree(childrenMap[item.path], level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className='flex flex-col w-full h-full bg-[#212121] text-white'>
      {/* Header */}
      <div className='flex-shrink-0 p-4 border-b border-[#303030]/30'>
        <div className='mb-3'>
          <IngestionExperience
            compact
            org={org}
            installationId={installationId}
          />
        </div>
        <div className='flex items-center gap-2'>
          <div className='w-6 h-6 bg-gradient-to-br from-[#5ea9ea] to-[#4a9ae0] rounded-lg flex items-center justify-center'>
            <svg
              className='w-3.5 h-3.5 text-white'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path d='M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z' />
            </svg>
          </div>
          <div>
            <h2 className='font-semibold text-[#fafafa] text-sm leading-none'>
              {repo}
            </h2>
            <p className='text-xs text-[#888] leading-none mt-0.5'>{owner}</p>
          </div>
        </div>
      </div>

      {/* File Tree */}
      <div className='flex-1 overflow-y-auto p-4'>
        <h3 className='text-xs font-medium text-[#888] uppercase tracking-wider mb-2'>
          Files
        </h3>
        <div className='space-y-0.5'>{renderTree(rootItems)}</div>
      </div>
    </div>
  );
};

export default Sidebar;
