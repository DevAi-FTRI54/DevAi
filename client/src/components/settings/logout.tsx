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

    // Remove tokens from storage
    sessionStorage.removeItem('accessToken');
    localStorage.removeItem('accessToken');

    // Redirect to login
    navigate('/login');
  };
};

export default useLogout;
