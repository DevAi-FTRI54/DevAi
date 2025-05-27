import React, { useState } from 'react';
import type { GitHubContentItem } from '../../../types';
import type { TreeNodeProps } from '../../../types';

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
      onFileSelect(path); // Send the full file path to parent
    }
  };

  return (
    <div style={{ marginLeft: 20 }}>
      <div onClick={type === 'dir' ? handleToggle : handleFileClick} style={{ cursor: 'pointer' }}>
        {type === 'dir' ? (expanded ? '📂' : '📁') : '📄'} {name}
      </div>

      {loading && <div style={{ marginLeft: 20 }}>Loading...</div>}

      {expanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.path}
              name={child.name}
              path={child.path}
              type={child.type}
              owner={owner}
              repo={repo}
              token={token}
              onFileSelect={onFileSelect} // Pass down the callback
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeNode;
