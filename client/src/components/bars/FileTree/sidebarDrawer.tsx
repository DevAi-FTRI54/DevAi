import React, { useEffect, useState } from 'react';
import type { GitHubContentItem, SidebarProps } from '../../../types';
import { getRepoContents } from '../../../api';
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
import { SiTypescript, SiJavascript, SiReact, SiJson, SiHtml5, SiCss3, SiMarkdown } from 'react-icons/si';

const Sidebar: React.FC<SidebarProps> = ({ owner, repo, token, onFileSelect, org, installationId }) => {
  const [rootItems, setRootItems] = useState<GitHubContentItem[]>([]);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [childrenMap, setChildrenMap] = useState<Record<string, GitHubContentItem[]>>({});

  useEffect(() => {
    const fetchRoot = async () => {
      try {
        const data = await getRepoContents(owner, repo, '', token);
        setRootItems(data);
      } catch (err: unknown) {
        // handle error
        console.error('found Error', err);
        setRootItems([]);
      }
    };
    fetchRoot();
  }, [owner, repo, token]);

  const handleToggle = async (path: string) => {
    setExpandedMap((prev) => ({ ...prev, [path]: !prev[path] }));
    if (!childrenMap[path]) {
      try {
        const data = await getRepoContents(owner, repo, path, token);
        setChildrenMap((prev) => ({ ...prev, [path]: data }));
      } catch (err) {
        // handle error, optionally
        console.error('found Error', err);
        setChildrenMap((prev) => ({ ...prev, [path]: [] }));
      }
    }
  };

  // useEffect(() => {
  //   const fetchRoot = async () => {
  //     const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  //     const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, { headers });
  //     const data: GitHubContentItem[] = await res.json();
  //     setRootItems(data);
  //   };
  //   fetchRoot();
  // }, [owner, repo, token]);

  // const handleToggle = async (path: string) => {
  //   setExpandedMap((prev) => ({ ...prev, [path]: !prev[path] }));

  //   if (!childrenMap[path]) {
  //     const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  //     const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });
  //     const data: GitHubContentItem[] = await res.json();
  //     setChildrenMap((prev) => ({ ...prev, [path]: data }));
  //   }
  // };

  // Choose an icon based on file type/extension
  const getFileIcon = (item: GitHubContentItem, expanded: boolean) => {
    if (item.type === 'dir') {
      return expanded ? <VscFolderOpened className="inline-block mr-1" /> : <VscFolder className="inline-block mr-1" />;
    }

    // React-specific: .tsx and .jsx
    if (item.name.endsWith('.tsx') || item.name.endsWith('.jsx')) {
      return <SiReact className="inline-block mr-1 text-[#61dafb]" />;
    }
    // TypeScript: .ts (but not .tsx)
    if (item.name.endsWith('.ts') && !item.name.endsWith('.tsx')) {
      return <SiTypescript className="inline-block mr-1 text-[#3178c6]" />;
    }
    // JavaScript: .js (but not .jsx)
    if (item.name.endsWith('.js') && !item.name.endsWith('.jsx')) {
      return <SiJavascript className="inline-block mr-1 text-[#f7df1e]" />;
    }
    // JSON
    if (item.name.endsWith('.json')) {
      return <SiJson className="inline-block mr-1 text-[#cbcb41]" />;
    }
    // HTML
    if (item.name.endsWith('.html')) {
      return <SiHtml5 className="inline-block mr-1 text-[#e34c26]" />;
    }
    // CSS
    if (item.name.endsWith('.css')) {
      return <SiCss3 className="inline-block mr-1 text-[#264de4]" />;
    }
    // Markdown
    if (item.name.endsWith('.md')) {
      return <SiMarkdown className="inline-block mr-1 text-[#ffffff]" />;
    }

    // Generic code file
    const ext = item.name.split('.').pop()?.toLowerCase();
    if (['py', 'rb', 'java', 'go', 'c', 'cpp', 'cs', 'php', 'sh', 'yml', 'yaml'].includes(ext || '')) {
      return <VscFileCode className="inline-block mr-1" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp', 'webp', 'ico', 'mp4', 'mp3', 'webm', 'mov'].includes(ext || '')) {
      return <VscFileMedia className="inline-block mr-1" />;
    }
    if (['zip', 'rar', 'tar', 'gz', 'bz2', '7z'].includes(ext || '')) {
      return <VscFileZip className="inline-block mr-1" />;
    }
    if (['pdf'].includes(ext || '')) {
      return <VscFilePdf className="inline-block mr-1" />;
    }
    if (['exe', 'bin', 'dll', 'so', 'dylib'].includes(ext || '')) {
      return <VscFileBinary className="inline-block mr-1" />;
    }
    return <VscFile className="inline-block mr-1" />;
  };

  const renderTree = (items: GitHubContentItem[], level = 0): React.ReactElement[] => {
    return items.map((item) => {
      const isDir = item.type === 'dir';
      const expanded = expandedMap[item.path];

      return (
        <div key={item.path} style={{ marginLeft: level * 12 }} className="text-sm font-mono">
          <div
            onClick={() => (isDir ? handleToggle(item.path) : onFileSelect(item.path))}
            className={`cursor-pointer py-0.5 px-1 rounded transition
              ${
                isDir
                  ? expanded
                    ? 'text-[#5EEAD4]'
                    : 'text-blue-400'
                  : 'text-blue-300 hover:bg-[#393E6B] hover:text-[#5EEAD4]'
              }
            `}
          >
            {getFileIcon(item, expanded)}
            <span className="ml-1">{item.name}</span>
          </div>
          {isDir && expanded && childrenMap[item.path] && (
            <div className="pl-4 border-l border-[#2D2D37] ml-1">{renderTree(childrenMap[item.path], level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#23272F] text-white border-r border-[#2D2D37]">
      <div className="mb-2 text-xs p-2">
        <IngestionExperience compact org={org} installationId={installationId} />
      </div>
      <div className="font-bold text-xs mb-2 px-2">
        {owner}/{repo}
      </div>
      <div className="flex-1 overflow-y-auto p-2">{renderTree(rootItems)}</div>
    </div>
  );
};

export default Sidebar;
