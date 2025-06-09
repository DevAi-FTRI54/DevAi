import React, { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
import type { GitHubContentItem, SidebarProps } from '../../../types';
// import { IngestionContext } from '../../ingestion/ingestioncontext';
import IngestionExperience from '../../ingestion/ingestionexperience';

const Sidebar: React.FC<SidebarProps> = ({ owner, repo, token, onFileSelect, org, installationId }) => {
  const [rootItems, setRootItems] = useState<GitHubContentItem[]>([]);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [childrenMap, setChildrenMap] = useState<Record<string, GitHubContentItem[]>>({});

  useEffect(() => {
    const fetchRoot = async () => {
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, { headers });
      const data: GitHubContentItem[] = await res.json();
      setRootItems(data);
    };
    fetchRoot();
  }, [owner, repo, token]);

  const handleToggle = async (path: string) => {
    setExpandedMap((prev) => ({ ...prev, [path]: !prev[path] }));

    if (!childrenMap[path]) {
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });
      const data: GitHubContentItem[] = await res.json();
      setChildrenMap((prev) => ({ ...prev, [path]: data }));
    }
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
            {isDir ? (expanded ? '📂' : '📁') : '📄'} <span className="ml-1">{item.name}</span>
          </div>
          {isDir && expanded && childrenMap[item.path] && (
            <div className="pl-4 border-l border-[#232946] ml-1">{renderTree(childrenMap[item.path], level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#232946] text-black border-r border-[#39415a]">
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
