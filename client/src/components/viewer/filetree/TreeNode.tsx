import React, { useState } from 'react';

//* this file is to handle recursive rendering & lazy load on file tree structure in GithubContentItem
export interface GitHubContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

interface TreeNodeProps {
  name: string;
  path: string;
  type: 'file' | 'dir';
  owner: string;
  repo: string;
  token?: string;
}

const TreeNode: React.FC<TreeNodeProps> = ({ name, path, type, owner, repo, token }) => {
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

  return (
    <div style={{ marginLeft: 20 }}>
      <div onClick={handleToggle} style={{ cursor: type === 'dir' ? 'pointer' : 'default' }}>
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
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeNode;
