import React from 'react';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';

interface Props {
  path: string[];
  onClick: (index: number) => void;
}

const DynamicBreadcrumbs: React.FC<Props> = ({ path, onClick }) => {
  return (
    <Breadcrumbs
      maxItems={6}
      aria-label="breadcrumb"
      sx={{ color: 'white' }} // ⬅️ Set default breadcrumb text to white
    >
      {path.map((segment, index) =>
        index === path.length - 1 ? (
          <Typography key={index} sx={{ color: 'white', fontSize: 14 }}>
            {segment}
          </Typography>
        ) : (
          <Link
            key={index}
            underline="hover"
            color="inherit" // uses parent color, i.e. white
            fontSize={14}
            onClick={() => onClick(index)}
            sx={{ cursor: 'pointer', color: 'white' }} // ⬅️ Set link text to white
          >
            {segment}
          </Link>
        )
      )}
    </Breadcrumbs>
  );
};

export default DynamicBreadcrumbs;
