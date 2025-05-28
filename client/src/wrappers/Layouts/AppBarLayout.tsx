// layouts/AppBarHomeLayout.jsx
import AppBarHome from '../../components/bars/appBarHome/appbarhome';
import { Outlet } from 'react-router-dom';

export default function AppBarHomeLayout() {
  return (
    <>
      <AppBarHome />
      <Outlet />
    </>
  );
}
