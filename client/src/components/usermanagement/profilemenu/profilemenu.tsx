import React, { useState } from 'react';
import { Avatar, Menu, MenuItem, IconButton } from '@mui/material';
import logo from '../../../assets/profile.jpg';
// import styles from './login.module.css';

export default function LoginProfile() {
  //*create state for menu visibility
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  //*function for controlling whether dropdown is open or closed
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton onClick={handleClick}>
        <Avatar alt="userAvatar" src={logo} />
      </IconButton>
      {/*prettier-ignore*/}
      {/* <div className={styles.profileContainer}> */}
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={handleClose}>Profile</MenuItem>
        <MenuItem onClick={handleClose}>Settings</MenuItem>
        <MenuItem onClick={handleClose}>History</MenuItem>
        <MenuItem onClick={handleClose}>Logout</MenuItem>
        {/* </div> */}
      </Menu>
    </>
  );
}
