import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import useLogout from '../../settings/logout';

const settings = ['Account', 'Chat History', 'Logout'];

const UserAvatarMenu: React.FC = () => {
  const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(null);
  const logout = useLogout(); // <--- Use the hook

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const navigate = useNavigate();

  // New handler for menu item clicks
  const handleMenuItemClick = (setting: string) => {
    handleCloseUserMenu();
    if (setting === 'Logout') {
      logout();
    } else if (setting === 'Chat History') {
      navigate('/chat/history'); // Navigate to the chat history route
    } else if (setting === 'Account') {
      navigate('/settings/account');
    } else {
      console.log(`Clicked on ${setting}`);
    }
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
          <MenuItem key={setting} onClick={() => handleMenuItemClick(setting)}>
            <Typography sx={{ textAlign: 'center' }}>{setting}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
};

export default UserAvatarMenu;
