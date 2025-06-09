import { useNavigate } from 'react-router-dom';

const useLogout = () => {
  const navigate = useNavigate();

  return async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
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
