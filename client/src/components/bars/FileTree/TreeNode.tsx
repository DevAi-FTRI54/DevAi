import React, { useState } from 'react';
import type { GitHubContentItem, TreeNodeProps } from '../../../types';

const TreeNode: React.FC<TreeNodeProps> = ({ name, path, type, owner, repo, token, onFileSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<GitHubContentItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (type !== 'dir') return;
    setExpanded(!expanded);

    if (!loaded) {
      setLoading(true);
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });
      const data: GitHubContentItem[] = await res.json();
      setChildren(data);
      setLoaded(true);
      setLoading(false);
    }
  };

  const handleFileClick = () => {
    if (type === 'file' && onFileSelect) {
      onFileSelect(path);
    }
  };

  return (
    <div>
      <div
        className={`
          flex items-center cursor-pointer font-mono select-none
          ${
            type === 'dir'
              ? expanded
                ? 'text-[#5EEAD4]'
                : 'text-blue-400'
              : 'text-blue-300 hover:bg-[#393E6B] hover:text-[#5EEAD4] rounded'
          }
          px-1 py-0.5 transition
        `}
        style={{ marginLeft: '0.25rem' }}
        onClick={type === 'dir' ? handleToggle : handleFileClick}
      >
        {type === 'dir' ? (expanded ? '📂' : '📁') : '📄'}
        <span className="ml-2">{name}</span>
      </div>

      {loading && <div className="pl-6 text-gray-400 text-xs animate-pulse">Loading…</div>}

      {expanded && children.length > 0 && (
        <div className="pl-4 border-l border-[#232946] ml-1">
          {children.map((child) => (
            <TreeNode
              key={child.path}
              name={child.name}
              path={child.path}
              type={child.type}
              owner={owner}
              repo={repo}
              token={token}
              onFileSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeNode;
