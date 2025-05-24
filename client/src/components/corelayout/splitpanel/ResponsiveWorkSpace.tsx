import React, { useState } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';

interface Props {
  sidebar: React.ReactNode;
  chat: React.ReactNode;
  fileViewer: React.ReactNode;
  onFileSelect?: (filePath: string) => void;
}

const ResponsiveWorkspace: React.FC<Props> = ({ sidebar, chat, fileViewer }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [activeTab, setActiveTab] = useState(0);

  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Box sx={{ flexShrink: 0 }}>
          <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)} centered>
            <Tab label="Chat" />
            <Tab label="Files" />
          </Tabs>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto' }}>{activeTab === 0 ? chat : fileViewer}</Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Box sx={{ width: 240, borderRight: '1px solid #ccc', overflowY: 'auto' }}>{sidebar}</Box>
      <Box sx={{ flex: 1, overflow: 'auto' }}>{chat}</Box>
      <Box sx={{ width: '40%', minWidth: 300, borderLeft: '1px solid #ccc', overflowY: 'auto' }}>{fileViewer}</Box>
    </Box>
  );
};

export default ResponsiveWorkspace;
