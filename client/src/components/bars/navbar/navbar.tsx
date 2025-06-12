import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import useLogout from '../../settings/logout';
import { useCurrentUser } from '../../../hooks/useCurrentUser';

const settings = ['Chat History', 'Logout']; // ! add back in after OSP 'Account'

const UserAvatarMenu: React.FC = () => {
  const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(
    null
  );
  const logout = useLogout(); // <--- Use the hook
  const { displayName, isLoading } = useCurrentUser();

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
      // } else if (setting === 'Account') {
      //   navigate('/settings/account');
    } else {
      console.log(`Clicked on ${setting}`);
    }
  };

  return (
    <div
      className='absolute right-6 z-50'
      style={{ 
        pointerEvents: 'auto', // ensure click passes through overlay
        top: '14px' // Custom positioning between top and file preview line
      }}
    >
      <button
        onClick={handleOpenUserMenu}
        className='h-8 px-2.5 bg-gradient-to-br from-[#5ea9ea] to-[#4a9ae0] hover:from-[#4a9ae0] hover:to-[#3a8bd0] rounded-full flex items-center gap-2 justify-center transition-all duration-200 border-2 border-[#303030] hover:border-[#5ea9ea] shadow-lg hover:shadow-xl min-w-[70px]'
        title='Open settings'
      >
        {isLoading ? (
          <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
        ) : (
          <>
            <svg
              className='w-3.5 h-3.5 text-white flex-shrink-0'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z'
                clipRule='evenodd'
              />
            </svg>
            <span className='text-white font-medium text-xs truncate max-w-[90px]'>
              {displayName || 'User'}
            </span>
          </>
        )}
      </button>
      <Menu
        sx={{
          mt: '32px',
          '& .MuiPaper-root': {
            backgroundColor: '#212121',
            border: '1px solid #303030',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
            minWidth: '160px',
          },
          '& .MuiMenuItem-root': {
            color: '#fafafa',
            fontSize: '14px',
            padding: '8px 16px',
            '&:hover': {
              backgroundColor: '#303030',
            },
          },
        }}
        id='menu-appbar'
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
            <div className='flex items-center gap-2'>
              {setting === 'Chat History' && (
                <svg
                  className='w-4 h-4'
                  fill='currentColor'
                  viewBox='0 0 20 20'
                >
                  <path
                    fillRule='evenodd'
                    d='M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z'
                    clipRule='evenodd'
                  />
                </svg>
              )}
              {setting === 'Logout' && (
                <svg
                  className='w-4 h-4'
                  fill='currentColor'
                  viewBox='0 0 20 20'
                >
                  <path
                    fillRule='evenodd'
                    d='M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z'
                    clipRule='evenodd'
                  />
                </svg>
              )}
              <span>{setting}</span>
            </div>
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
};

export default UserAvatarMenu;
