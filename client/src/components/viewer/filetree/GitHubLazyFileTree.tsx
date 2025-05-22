import React, { useEffect, useState } from 'react';
import TreeNode from './TreeNode';
import type { GitHubContentItem } from './TreeNode';

interface GitHubLazyFileTreeProps {
  owner: string;
  repo: string;
  token?: string;
}

const GitHubLazyFileTree: React.FC<GitHubLazyFileTreeProps> = ({ owner, repo, token }) => {
  const [rootItems, setRootItems] = useState<GitHubContentItem[]>([]);

  useEffect(() => {
    const fetchRoot = async () => {
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, {
        headers,
      });
      const data: GitHubContentItem[] = await res.json();
      setRootItems(data);
    };

    fetchRoot();
  }, [owner, repo, token]);

  return (
    <div>
      {rootItems.map((item) => (
        <TreeNode
          key={item.path}
          name={item.name}
          path={item.path}
          type={item.type}
          owner={owner}
          repo={repo}
          token={token}
        />
      ))}
    </div>
  );
};

export default GitHubLazyFileTree;
