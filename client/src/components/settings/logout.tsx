import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../../api'; // adjust path as needed

const useLogout = () => {
  const navigate = useNavigate();

  return async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Error logging out', err);
    }

    // Cookies are cleared by server on /auth/logout; no client token storage (cookies-only).

    // Redirect to login
    navigate('/login');
  };
};

export default useLogout;
