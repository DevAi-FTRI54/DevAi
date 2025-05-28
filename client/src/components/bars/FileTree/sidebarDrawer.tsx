import * as React from 'react';
import GitHubLazyFileTree from './GitHubLazyFileTree';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

const drawerWidth = 350;

const DrawerHeader = styled('div')(() => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
  // marginTop: '0.5rem',
}));

interface PermanentSidebarProps {
  owner: string;
  repo: string;
  onFileSelect: (filePath: string) => void;
  token?: string; // Optional if you want to pass auth token
}

const PermanentSidebar: React.FC<PermanentSidebarProps> = ({ owner, repo, onFileSelect, token }) => {
  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            top: 75, // Matches AppBar height (adjust as needed)
            height: 'calc(100% - 64px)',
            backgroundColor: '#232946', // <--- Set your dark color here!
            color: '#C8D6E5', // <--- Optional: set font color to match!
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <DrawerHeader>
          <Typography variant="subtitle1" fontWeight="bold" noWrap>
            {owner}/{repo}
          </Typography>
        </DrawerHeader>
        <Divider />
        <Box sx={{ paddingLeft: 2, paddingTop: 1 }}>
          <GitHubLazyFileTree
            owner={owner}
            repo={repo}
            token={token}
            onFileSelect={onFileSelect} // ✅ Pass file select handler
          />
        </Box>
      </Drawer>
    </Box>
  );
};

export default PermanentSidebar;
