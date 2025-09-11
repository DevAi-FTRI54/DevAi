// layouts/AppBarHomeLayout.jsx
import AppBarHome from '../../components/bars/appBarHome/appbarhome';
import React from 'react';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

interface AppBarHomeLayoutProps {
  children: ReactNode;
}

export const AppBarHomeLayout: React.FC<AppBarHomeLayoutProps> = ({ children }) => {
  return (
    <>
      <AppBarHome />
      {children}
      <Outlet />
    </>
  );
};
