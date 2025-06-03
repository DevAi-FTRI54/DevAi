// import * as React from 'react';
// import GitHubLazyFileTree from './GitHubLazyFileTree';
// import { styled } from '@mui/material/styles';
// import Box from '@mui/material/Box';
// import Drawer from '@mui/material/Drawer';
// import CssBaseline from '@mui/material/CssBaseline';
// import Divider from '@mui/material/Divider';
// import Typography from '@mui/material/Typography';

// const drawerWidth = {
//   xs: '60%',
//   sm: 300,
//   md: 350,
// };

// const DrawerHeader = styled('div')(() => ({
//   display: 'flex',
//   alignItems: 'center',
//   justifyContent: 'center',
//   padding: '1rem',
// }));

// interface PermanentSidebarProps {
//   owner: string;
//   repo: string;
//   repoData: {
//     id: number;
//     full_name: string;
//     html_url: string;
//     sha: string;
//   };
//   onFileSelect: (filePath: string) => void;
//   token: string;
// }

// const PermanentSidebar: React.FC<PermanentSidebarProps> = ({ owner, repo, onFileSelect, token }) => {
//   return (
//     <Box sx={{ display: 'flex' }}>
//       <CssBaseline />
//       <Drawer
//         sx={{
//           width: drawerWidth,
//           flexShrink: 1,
//           '& .MuiDrawer-paper': {
//             width: drawerWidth,
//             boxSizing: 'border-box',
//             top: 75,
//             height: 'calc(100% - 64px)',
//             backgroundColor: '#232946',
//             color: '#C8D6E5',
//             transition: 'width 0.3s ease',
//           },
//         }}
//         variant="permanent"
//         anchor="left"
//       >
//         <DrawerHeader>
//           <Typography variant="subtitle1" fontWeight="bold" noWrap>
//             {owner}/{repo}
//           </Typography>
//         </DrawerHeader>
//         <Divider />
//         <Box sx={{ paddingLeft: 2, paddingTop: 1 }}>
//           <GitHubLazyFileTree
//             owner={owner}
//             repo={repo}
//             token={token}
//             onFileSelect={onFileSelect}
//           />
//         </Box>
//       </Drawer>
//     </Box>
//   );
// };

// export default PermanentSidebar;

import React, { useEffect, useState } from 'react';
import type { GitHubContentItem, SidebarProps } from '../../../types';

const Sidebar: React.FC<SidebarProps> = ({ owner, repo, token, onFileSelect }) => {
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
    <div className="flex flex-col w-full h-full overflow-y-auto p-3 bg-[#232946] text-white border-r border-[#39415a]">
      <div className="font-bold text-xs mb-2">
        {owner}/{repo}
      </div>
      {renderTree(rootItems)}
    </div>
  );
};

export default Sidebar;
