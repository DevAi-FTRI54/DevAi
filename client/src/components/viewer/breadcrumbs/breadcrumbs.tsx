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
    <Breadcrumbs maxItems={6} aria-label="breadcrumb">
      {path.map((segment, index) =>
        index === path.length - 1 ? (
          <Typography key={index} color="text.primary" fontSize={14}>
            {segment}
          </Typography>
        ) : (
          <Link
            key={index}
            underline="hover"
            color="inherit"
            fontSize={14}
            onClick={() => onClick(index)}
            sx={{ cursor: 'pointer' }}
          >
            {segment}
          </Link>
        )
      )}
    </Breadcrumbs>
  );
};

export default DynamicBreadcrumbs;
