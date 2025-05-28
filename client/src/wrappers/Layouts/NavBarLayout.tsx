// layouts/NavBarLayout.jsx
import NavBar from '../../components/bars/navbar/navbar';
import { Outlet } from 'react-router-dom';

export default function NavBarLayout() {
  return (
    <>
      <NavBar />
      <Outlet />
    </>
  );
}
