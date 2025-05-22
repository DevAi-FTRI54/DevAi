import * as React from 'react';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';

// interface HandleClickProps {
//   event: React.MouseEvent<HTMLDivElement, MouseEvent>;
// }

const handleClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>): void => {
  event.preventDefault();
  console.info('You clicked a breadcrumb');
};

const CollopasedBreadcrumb: React.FC = () => {
  return (
    <div role="presentation" onClick={handleClick}>
      <Breadcrumbs maxItems={2} aria-label="breadcrumb">
        <Link underline="hover" color="inherit" href="#">
          Home
        </Link>
        <Link underline="hover" color="inherit" href="#">
          Catalog
        </Link>
        <Link underline="hover" color="inherit" href="#">
          Accessories
        </Link>
        <Link underline="hover" color="inherit" href="#">
          New Collection
        </Link>
        <Typography sx={{ color: 'text.primary' }}>Belts</Typography>
      </Breadcrumbs>
    </div>
  );
};

export default CollopasedBreadcrumb;
