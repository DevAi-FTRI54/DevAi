import React from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role='tabpanel'
      hidden={value !== index}
      id={`tablpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

// function FilePreview() {
//   return <div>File Preview</div>;
// }

const TabComps: React.FC = () => {
  const [value, setValue] = React.useState(0);

  return (
    <Box>
      <Tabs value={value} onChange={(_, v) => setValue(v)}>
        <Tab label='Index.html' />
        <Tab label='server.js' />
        <Tab label='app.jsx' />
      </Tabs>
      <TabPanel value={value} index={1}>
        {/* <FilePreview /> */}
      </TabPanel>
    </Box>
  );
};

export default TabComps;
