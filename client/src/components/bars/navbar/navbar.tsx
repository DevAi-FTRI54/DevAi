import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';

const settings = ['Account', 'Settings', 'Logout'];

const UserAvatarMenu: React.FC = () => {
  const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(null);

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };
  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  return (
    <div className="w-full flex justify-end pr-6 pt-4 bg-[#121629]">
      <Tooltip title="Open settings">
        <IconButton onClick={handleOpenUserMenu} size="large">
          <Avatar alt="User" src="/static/images/avatar/2.jpg" sx={{ width: 40, height: 40 }} />
        </IconButton>
      </Tooltip>
      <Menu
        sx={{ mt: '45px' }}
        id="menu-appbar"
        anchorEl={anchorElUser}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={Boolean(anchorElUser)}
        onClose={handleCloseUserMenu}
      >
        {settings.map((setting) => (
          <MenuItem key={setting} onClick={handleCloseUserMenu}>
            <Typography sx={{ textAlign: 'center' }}>{setting}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
};

export default UserAvatarMenu;

// import * as React from 'react';
// import AppBar from '@mui/material/AppBar';
// import Box from '@mui/material/Box';
// import Toolbar from '@mui/material/Toolbar';
// import Typography from '@mui/material/Typography';
// import Avatar from '@mui/material/Avatar';
// import Tooltip from '@mui/material/Tooltip';
// import IconButton from '@mui/material/IconButton';
// import Menu from '@mui/material/Menu';
// import MenuItem from '@mui/material/MenuItem';
// import Container from '@mui/material/Container';

// const settings = ['Account', 'Settings', 'Logout'];

// const NavBar: React.FC = () => {
//   const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(null);

//   const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
//     setAnchorElUser(event.currentTarget);
//   };
//   const handleCloseUserMenu = () => {
//     setAnchorElUser(null);
//   };

//   return (
//     // <--- NEW: This wrapper gives just the AppBar a dark background
//     <div className="w-full flex justify-center bg-[#232946] min-h-[72px]">
//       <AppBar
//         position="static"
//         color="transparent"
//         sx={{
//           zIndex: (theme) => theme.zIndex.drawer + 1,
//           height: 56,
//           width: { xl: '80%', sm: 500 },
//           mx: 'auto',
//           left: 0,
//           right: 0,
//           mt: 1, // moved AppBar up
//           borderRadius: '36px',
//           backgroundColor: '#6a7280',
//           boxShadow: 'none',
//         }}
//       >
//         <Container maxWidth="xl" disableGutters>
//           <Toolbar
//             disableGutters
//             sx={{
//               height: '56px',
//               minHeight: '56px !important',
//               display: 'flex',
//               alignItems: 'center',
//               justifyContent: 'space-between',
//             }}
//           >
//             {/* Logo - Left */}
//             <Typography
//               variant="h6"
//               noWrap
//               component="a"
//               href="#"
//               sx={{
//                 ml: 2,
//                 fontFamily: 'TT Hoves',
//                 textTransform: 'none',
//                 fontWeight: 700,
//                 letterSpacing: '.3rem',
//                 color: 'inherit',
//                 textDecoration: 'none',
//               }}
//             >
//               dev.ai
//             </Typography>

//             {/* Avatar - Right */}
//             <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
//               <Tooltip title="Open settings">
//                 <IconButton onClick={handleOpenUserMenu} size="large">
//                   <Avatar alt="Remy Sharp" src="/static/images/avatar/2.jpg" sx={{ width: 40, height: 40 }} />
//                 </IconButton>
//               </Tooltip>
//               <Menu
//                 sx={{ mt: '45px' }}
//                 id="menu-appbar"
//                 anchorEl={anchorElUser}
//                 anchorOrigin={{
//                   vertical: 'top',
//                   horizontal: 'right',
//                 }}
//                 keepMounted
//                 transformOrigin={{
//                   vertical: 'top',
//                   horizontal: 'right',
//                 }}
//                 open={Boolean(anchorElUser)}
//                 onClose={handleCloseUserMenu}
//               >
//                 {settings.map((setting) => (
//                   <MenuItem key={setting} onClick={handleCloseUserMenu}>
//                     <Typography sx={{ textAlign: 'center' }}>{setting}</Typography>
//                   </MenuItem>
//                 ))}
//               </Menu>
//             </Box>
//           </Toolbar>
//         </Container>
//       </AppBar>
//     </div>
//   );
// };

// export default NavBar;
