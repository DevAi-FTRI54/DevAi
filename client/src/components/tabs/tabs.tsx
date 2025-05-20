import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';

const ContextTabs: React.FC = () => {
  const [value, setValue] = React.useState(0);
  const handleChange = (_: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Tabs onChange={handleChange} value={value} aria-label="Tabs where selection follows focus" selectionFollowsFocus>
        <Tab label="Chat Window" />
        <Tab label="File Preview" />
      </Tabs>
    </Box>
  );
};

export default ContextTabs;
