import React, { useEffect, useState } from 'react';
import TreeNode from '../FileTree/TreeNode';
import type { GitHubContentItem } from '../../../types';
import type { GitHubLazyFileTreeProps } from '../../../types';

const GitHubLazyFileTree: React.FC<GitHubLazyFileTreeProps> = ({
  owner,
  repo,
  token,
  onFileSelect,
}) => {
  const [rootItems, setRootItems] = useState<GitHubContentItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoot = async () => {
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents`,
        {
          headers,
        }
      );

      if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
      }

      const data: GitHubContentItem[] = await res.json();
      setRootItems(data);
      setError(null);
    };

    fetchRoot();
  }, [owner, repo, token]);

  if (error) {
    return <div className='text-red-400 p-2'>Error: {error}</div>;
  }

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
          onFileSelect={onFileSelect}
        />
      ))}
    </div>
  );
};

export default GitHubLazyFileTree;
